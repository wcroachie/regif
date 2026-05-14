var {
  quantize,
  quantizeAsync,
} = function(){

  const {
    NeuQuant,
    quantize,
    float2sampleFac,
  } = function(){

    "use strict";

    /**
     * NeuQuant Neural-Network Quantization Algorithm
     *
     * Copyright (c) 1994 Anthony Dekker
     *
     * See "Kohonen neural networks for optimal colour quantization" in "Network:
     * Computation in Neural Systems" Vol. 5 (1994) pp 351-367. for a discussion of
     * the algorithm.
     *
     * See also http://members.ozemail.com.au/~dekker/NEUQUANT.HTML
     *
     * Any party obtaining a copy of these files from the author, directly or
     * indirectly, is granted, free of charge, a full and unrestricted irrevocable,
     * world-wide, paid up, royalty-free, nonexclusive right and license to deal in
     * this software and documentation files (the "Software"), including without
     * limitation the rights to use, copy, modify, merge, publish, distribute,
     * sublicense, and/or sell copies of the Software, and to permit persons who
     * receive copies from any such party to do so, with the only requirement being
     * that this copyright notice remain intact.
     *
     * Copyright (c) 2012 Johan Nordberg (JavaScript port)
     * Copyright (c) 2014 Devon Govett (JavaScript port)
     */
    function NeuQuant( rgbBuff, options ){
      
      if( rgbBuff instanceof ArrayBuffer === false ){
        throw new Error("rgbBuff was not an ArrayBuffer");
      }
      
      if( rgbBuff.byteLength % 3 ){
        throw new Error("rgbBuff.byteLength was not a multiple of 3");
      }
      
      options = options || {};
      
      var rgbView = new Uint8Array( rgbBuff );
      
      var errPrefix = "<" + this.constructor.name + " instance>.constructor: ";

      /* ---------------------------- */

      var prime1 = 499;
      var prime2 = 491;
      var prime3 = 487;
      var prime4 = 503;

      var maxprime = Math.max(prime1, prime2, prime3, prime4);
      var minpicturebytes = (3 * maxprime);

      var defaults = {
        nCycles: 100,     /* number of cycles */
        netSize: 256,     /* number of colors used ( 4 - 256 ) */
        sampleFac: 10     /* sample factor, sampling factor 1 to 30 where lower is better quality */
      };

      function assign(target) {
        var i, len, nextSource, nextKey;
        for( i=1, len=arguments.length; i<len; i++ ){
          nextSource = arguments[i]
          if( nextSource !== null ){
            for( nextKey in nextSource ){
              if( {}.constructor.prototype.hasOwnProperty.call(nextSource, nextKey) ){
                target[nextKey] = nextSource[nextKey];
              }
            }
          }
        }
        return target;
      }

      this.unbiasnet = function unbiasnet(){

        var i, len;
        for( i=0, len=this.netSize; i<len; i++ ){
          this.network[i][0] >>= this.netbiasshift;
          this.network[i][1] >>= this.netbiasshift;
          this.network[i][2] >>= this.netbiasshift;
          this.network[i][3] = i;
        }

      }.bind( this );

      this.altersingle = function altersingle( alpha, i, b, g, r ){

        this.network[i][0] -= (alpha * (this.network[i][0] - b)) / this.initalpha;
        this.network[i][1] -= (alpha * (this.network[i][1] - g)) / this.initalpha;
        this.network[i][2] -= (alpha * (this.network[i][2] - r)) / this.initalpha;

      }.bind( this );

      this.alterneigh = function alterneigh( radius, i, b, g, r ){

        var lo = Math.abs(i - radius);
        var hi = Math.min(i + radius, this.netSize);

        var j = i + 1;
        var k = i - 1;
        var m = 1;
        var a, p;

        while( ( j < hi ) || ( k > lo ) ){

          a = this.radpower[m++];

          if( j < hi ){
            p = this.network[j++];
            p[0] -= (a * (p[0] - b)) / this.alpharadbias;
            p[1] -= (a * (p[1] - g)) / this.alpharadbias;
            p[2] -= (a * (p[2] - r)) / this.alpharadbias;
          }

          if( k > lo ){
            p = this.network[k--];
            p[0] -= (a * (p[0] - b)) / this.alpharadbias;
            p[1] -= (a * (p[1] - g)) / this.alpharadbias;
            p[2] -= (a * (p[2] - r)) / this.alpharadbias;
          }

        }

      }.bind( this );

      this.contest = function contest( b, g, r ){

        var bestd = ~(1 << 31);
        var bestbiasd = bestd;
        var bestpos = -1;
        var bestbiaspos = bestpos;
        var i, len, n, dist, biasdist, betafreq;

        for( i=0, len=this.netSize; i<len; i++ ){

          n = this.network[i];

          dist = Math.abs(n[0] - b) + Math.abs(n[1] - g) + Math.abs(n[2] - r);

          if( dist < bestd ){
            bestd = dist;
            bestpos = i;
          }

          biasdist = dist - ((this.bias[i]) >> (this.intbiasshift - this.netbiasshift));

          if( biasdist < bestbiasd ){
            bestbiasd = biasdist;
            bestbiaspos = i;
          }

          betafreq = (this.freq[i] >> this.betashift);

          this.freq[i] -= betafreq;
          this.bias[i] += (betafreq << this.gammashift);

        }

        this.freq[bestpos] += this.beta;
        this.bias[bestpos] -= this.betagamma;

        return bestbiaspos;

      }.bind( this );

      this.inxbuild = function inxbuild(){

        var previouscol = 0;
        var startpos = 0;
        var i, len, p, q, smallpos, smallval, j;
        var _a, _b, _c, _d;

        for( i=0, len=this.netSize; i<len; i++ ){

          p = this.network[i];
          q = null;

          smallpos = i;
          smallval = p[1];

          for( j=i+1; j<len; j++ ){
            q = this.network[j];
            if( q[1] < smallval ){
              smallpos = j;
              smallval = q[1];
            }
          }

          q = this.network[smallpos];

          if( i !== smallpos ){

            _a = p[0];
            _b = p[1];
            _c = p[2];
            _d = p[3];

            p[0] = q[0];
            p[1] = q[1];
            p[2] = q[2];
            p[3] = q[3];

            q[0] = _a;
            q[1] = _b;
            q[2] = _c;
            q[3] = _d;

          }

          if( smallval !== previouscol ){

            this.netindex[previouscol] = (startpos + i) >> 1;

            for( j=previouscol+1; j<smallval; j++ ){
              this.netindex[j] = i;
            }

            previouscol = smallval;
            startpos = i;

          }

        }

        this.netindex[previouscol] = (startpos + this.maxnetpos) >> 1;

        for( i=previouscol+1; i<256; i++ ){
          this.netindex[i] = this.maxnetpos;
        }

      }.bind( this );

      this.learn = function learn(){

        var lengthcount = this.rgbView.length;
        var alphadec = 30 + ((this.sampleFac - 1) / 3);
        var samplepixels = lengthcount / (3 * this.sampleFac);

        var delta = samplepixels / this.nCycles | 0;
        var alpha = this.initalpha;
        var radius = this.initradius;

        var rad = radius >> this.radiusbiasshift;

        if( rad <= 1 ){
          rad = 0;
        }

        var i;

        for( i=0; i<rad; i++ ){
          this.radpower[i] = alpha * (((rad * rad - i * i) * this.radbias) / (rad * rad));
        }

        var step;

        if( lengthcount < minpicturebytes ){
          this.sampleFac = 1;
          step = 3;
        }else if( (lengthcount % prime1) !== 0 ){
          step = 3 * prime1;
        }else if( (lengthcount % prime2) !== 0 ){
          step = 3 * prime2;
        }else if( (lengthcount % prime3) !== 0 ){
          step = 3 * prime3;
        }else{
          step = 3 * prime4;
        }

        var pix = 0;

        var b, g, r, j, k;

        for( i=0; i<samplepixels; ){

          b = (this.rgbView[pix] & 0xff) << this.netbiasshift;
          g = (this.rgbView[pix + 1] & 0xff) << this.netbiasshift;
          r = (this.rgbView[pix + 2] & 0xff) << this.netbiasshift;

          j = this.contest(b, g, r);
          this.altersingle(alpha, j, b, g, r);
          if( rad !== 0 ){
            this.alterneigh(rad, j, b, g, r);
          }

          pix += step;
          if( pix >= lengthcount ){
            pix -= lengthcount;
          }

          if( delta === 0 ){
            delta = 1;
          }

          if( ++i % delta === 0 ){

            alpha -= alpha / alphadec;
            radius -= radius / this.radiusdec;
            rad = radius >> this.radiusbiasshift;

            if( rad <= 1 ){
              rad = 0;
            }

            for( k=0; k<rad; k++ ){
              this.radpower[k] = alpha * (((rad * rad - k * k) * this.radbias) / (rad * rad));
            }
          }
        }
      }.bind( this );

      this.buildColorMap = function buildColorMap(){

        this.learn();
        this.unbiasnet();
        this.inxbuild();

      }.bind( this );

      this.getColorMap = function getColorMap(){

        var map = new Uint8Array(this.netSize * 3);
        var index = new Uint8Array(this.netSize);

        var i, len;
        for( i=0, len=this.netSize; i<len; i++ ){
          index[this.network[i][3]] = i;
        }

        var j, k;
        for( i=0, j=0, k=0, len=this.netSize; i<len; i++ ){
          k = index[i];
          map[j++] = this.network[k][0] & 0xff;
          map[j++] = this.network[k][1] & 0xff;
          map[j++] = this.network[k][2] & 0xff;
        }

        return map.buffer;

      }.bind( this );

      /* ---------------------------- */

      assign( this, defaults, { rgbView: rgbView }, options );

      if( this.netSize < 4 || this.netSize > 256 ){
        throw new Error(errPrefix + "Color count must be between 4 and 256");
      }

      if( this.sampleFac < 1 || this.sampleFac > 30 ){
        throw new Error(errPrefix + "Sampling factor must be between 1 and 30");
      }

      this.maxnetpos = this.netSize - 1;

      this.netbiasshift = 4;
      this.intbiasshift = 16;
      this.intbias = (1 << this.intbiasshift);
      this.gammashift = 10;
      this.gamma = (1 << this.gammashift);
      this.betashift = 10;
      this.beta = (this.intbias >> this.betashift);
      this.betagamma = (this.beta * this.gamma);

      this.initrad = (this.netSize >> 3);
      this.radiusbiasshift = 6;
      this.radiusbias = (1 << this.radiusbiasshift);
      this.initradius = (this.initrad * this.radiusbias);
      this.radiusdec = 30;

      this.alphabiasshift = 10;
      this.initalpha = (1 << this.alphabiasshift);

      this.radbiasshift = 8;
      this.radbias = (1 << this.radbiasshift);
      this.alpharadbshift = (this.alphabiasshift + this.radbiasshift);
      this.alpharadbias = (1 << this.alpharadbshift);

      this.network = [];
      this.netindex = new Uint32Array(256);
      this.bias = new Uint32Array(this.netSize);
      this.freq = new Uint32Array(this.netSize);
      this.radpower = new Uint32Array(this.netSize >> 3);

      var i, len, v;
      for( i=0, len=this.netSize; i<len; i++ ){
        v = (i << (this.netbiasshift + 8)) / this.netSize;
        this.network[i] = new Float64Array([v, v, v, 0]);
        this.freq[i] = this.intbias / this.netSize;
        this.bias[i] = 0;
      }

    }
    
    /**
     * convert a float provided for quality,
     * like when provided for toDataURL, to
     * the 1 - 30 sampleFac that NeuQuant uses
     */
    function float2sampleFac( any ){
      
      /* coerce to float */
      var f = Math.max( 0, Math.min( 1, +any) );
      
      /* convert to integer between 1 and 30 */
      var sf = 1 + ~~((1 - f) * 29);
      
      return sf;
      
    }

    /**
     * analyze and produce a palette using NeuQuant
     * algorithms
     * 
     * operates on rgb arraybuffer
     * 
     * options {
     *    quality.............a float between 0 and 1
     *    numColors...........number of colors, 4 to 256
     * }
     */
    function quantize( rgbBuff, options ){
      
      if( rgbBuff instanceof ArrayBuffer === false ){
        throw new Error("rgbBuff was not an ArrayBuffer");
      }
      
      if( rgbBuff.byteLength % 3 ){
        throw new Error("rgbBuff.byteLength was not a multiple of 3");
      }
      
      options = options || {};

      var sampleFac = 10;
      var numColors = 256;

      if( "quality" in options ){
        sampleFac = float2sampleFac( options.quality );
      }

      if( "numColors" in options ){
        numColors = Math.max( 4, Math.min( 256, options.numColors >>> 0 ) );
      }
      
      var nq = new NeuQuant( rgbBuff, {
        nCycles : 100,
        sampleFac : sampleFac,
        netSize : numColors
      } );
      
      nq.buildColorMap();

      /**
       * create palette
       */
      var palBuff = nq.getColorMap();
      var palette = new GifPalette();
      var palView = new Uint8Array( palBuff );
      var i, str;
      for( i=0; i<palView.length; ){
        str = "#";
        str += palView[i++].toString(16).padStart(2,"0");
        str += palView[i++].toString(16).padStart(2,"0");
        str += palView[i++].toString(16).padStart(2,"0");
        palette.addColor( str );
      }
      
      return palette;
      
    }
    
    return {
      NeuQuant,
      quantize,
      float2sampleFac,
    };

  }();
  
  const {
    QuantWorkerPool,
  } = function(){

    "use strict";

    const QUANT_WORKER_POOL_AUTOCLOSE_TIMEOUT = 20000;
    
    class QuantWorker{
      
      #closed = false;
      #busy = false;
      #worker = null;
      
      close(){
        if( this.#closed ){
          throw new Error("cannot call on a closed instance");
        }
        this.#worker.terminate();
        this.#closed = true;
      }
      
      get closed(){ return this.#closed }
      get busy(){ return this.#busy }
      
      async #doTask( method, args ){
        if( this.#closed ){
          throw new Error("cannot call on a closed instance");
        }
        if( this.#busy ){
          throw new Error("cannot call on a busy instance");
        }
        this.#busy = true;
        try{
          return await new Promise( (res, rej) => {
            this.#worker.onmessageerror = rej;
            this.#worker.onerror = rej;
            this.#worker.onmessage = ({data}) => res( data[0] );
            this.#worker.postMessage( [ method, args ] );
          } );
        }catch(e){
          throw e;
        }finally{
          this.#busy = false;
        }
      }
      
      /* --------------------------- */
      
      async quantize(...args){

        let colors = await this.#doTask("quantize", args );
        let pal = new GifPalette();
        for( let color of colors ){
          pal.addColor( color );
        }

        return pal;
        
      }
      
      constructor(){
        
        this.#worker = new Worker( URL.createObjectURL( new Blob([`
          
          ${ float2sampleFac }
          ${ GifPalette }
          ${ NeuQuant }
          ${ quantize }
          
          onmessage = ({data}) => {
            
            let [
              method,
              args,
            ] = data;
            
            if( method === "quantize" ){
              let { colors } = quantize(...args);
              postMessage( [ colors ] );
            }else{
              throw new Error("invalid method provided");
            }
            
          };
          
        `], {type:"text/javascript"}) ) );
        
      }
      
    }
    
    class QuantWorkerPool{
      
      #maxConcurrency = 2;
      #closed = false;
      
      get maxConcurrency(){ return this.#maxConcurrency }
      get close(){ return this.closed }
      
      #pool = [];
      
      async #getNextFreeWorker(){
        if( this.#closed ){
          throw new Error("cannot call on a closed instance");
        }
        return await new Promise( (res,rej) => {
          
          let iv = setInterval( () => {
            
            let freeWorker = null;
            
            for( let worker of this.#pool ){
              if( !worker.busy ){
                freeWorker = worker;
                break;
              }
            }
            
            /**
             * if pool size is less than the max concurrency,
             * add a new worker
             */
            if( !freeWorker && this.#pool.length < this.#maxConcurrency ){
              freeWorker = new (this.constructor.WORKER_CLASS)();
              this.#pool.push( freeWorker );
            }
            
            /**
             * if free worker, clear this interval and return,
             * otherwise we will have to wait until the next
             * event cycle
             */
            if( freeWorker ){
              clearInterval( iv );
              res( freeWorker );
            }else{
              console.warn("no free workers; waiting for next event cycle...");
            }
            
          } );
          
        } );
      }
      
      close(){
        if( this.#closed ){
          throw new Error("cannot call on a closed instance");
        }
        while( this.#pool.length ){
          let worker = this.#pool.shift();
          if( !worker.closed ){
            worker.close();
          }
        }
        this.#closed = true;
      }
      
      /**
       * this is the amount of workers this pool will spawn before
       * refusing to spawn anymore and telling getNextFreeWorker to
       * wait
       */
      constructor( maxConcurrency ){
        this.#maxConcurrency = Math.max( 2, maxConcurrency >>> 0 );
      }
      
      /* --------------------------- */
      
      static WORKER_CLASS = QuantWorker;
      
      async quantize( rgbBuff, options ){
        let worker = await this.#getNextFreeWorker();
        try{
          return await worker.quantize( rgbBuff, options );
        }catch(e){
          throw e;
        }finally{
          /**
           * intermittently check to see if the worker is
           * still busy with a task; if not, close it
           */
          let iv = setInterval( () => {
            if( !worker.busy && !worker.closed ){
              worker.close();
              this.#pool.splice( this.#pool.indexOf( worker ), 1 );
              clearInterval( iv );
            }
          }, QUANT_WORKER_POOL_AUTOCLOSE_TIMEOUT );
        }
      }
      
    }
    
    return {
      QuantWorkerPool,
    };
    
  }();
  
  const {
    quantizeAsync,
  } = function(){
    
    "use strict";
    
    const INTERNAL_POOL_MAX_CONC = ( globalThis.navigator?.hardwareConcurrency || 1 ) * 4;
    let INTERNAL_POOL = null;
    
    async function quantizeAsync(...args){
      if( INTERNAL_POOL === null ){
        INTERNAL_POOL = new QuantWorkerPool( INTERNAL_POOL_MAX_CONC );
      }
      return await INTERNAL_POOL.quantize(...args);
    }

    return {
      quantizeAsync,
    };
    
  }();
  
  return {
    quantize,
    quantizeAsync,
  };
  
}()