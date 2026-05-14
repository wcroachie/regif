var {
  rgb2indexed,
  indexed2rgb,
  rgb2indexedAsync,
  indexed2rgbAsync,
} = function(){

  const {
    DITHER_KERNELS,
    findClosestRgb,
    getIndexedSharp,
    getIndexedDithered,
    rgb2indexed,
    indexed2rgb,
  } = function(){
    
    "use strict";
    
    var DITHER_KERNELS = {
      "floyd-steinberg": [
         [7 / 16, 1, 0],
         [3 / 16, -1, 1],
         [5 / 16, 0, 1],
         [1 / 16, 1, 1]
      ],
      "false-floyd-steinberg": [
         [3 / 8, 1, 0],
         [3 / 8, 0, 1],
         [2 / 8, 1, 1]
      ],
      "stucki": [
         [8 / 42, 1, 0],
         [4 / 42, 2, 0],
         [2 / 42, -2, 1],
         [4 / 42, -1, 1],
         [8 / 42, 0, 1],
         [4 / 42, 1, 1],
         [2 / 42, 2, 1],
         [1 / 42, -2, 2],
         [2 / 42, -1, 2],
         [4 / 42, 0, 2],
         [2 / 42, 1, 2],
         [1 / 42, 2, 2]
      ],
      "atkinson": [
         [1 / 8, 1, 0],
         [1 / 8, 2, 0],
         [1 / 8, -1, 1],
         [1 / 8, 0, 1],
         [1 / 8, 1, 1],
         [1 / 8, 0, 2]
      ],
      "jarvis": [
         [7 / 48, 1, 0],
         [5 / 48, 2, 0],
         [3 / 48, -2, 1],
         [5 / 48, -1, 1],
         [7 / 48, 0, 1],
         [5 / 48, 1, 1],
         [3 / 48, 2, 1],
         [1 / 48, -2, 2],
         [3 / 48, -1, 2],
         [5 / 48, 0, 2],
         [3 / 48, 1, 2],
         [1 / 48, 2, 2]
      ],
      "burkes": [
         [8 / 32, 1, 0],
         [4 / 32, 2, 0],
         [2 / 32, -2, 1],
         [4 / 32, -1, 1],
         [8 / 32, 0, 1],
         [4 / 32, 1, 1],
         [2 / 32, 2, 1]
      ],
      "sierra": [
         [5 / 32, 1, 0],
         [3 / 32, 2, 0],
         [2 / 32, -2, 1],
         [4 / 32, -1, 1],
         [5 / 32, 0, 1],
         [4 / 32, 1, 1],
         [2 / 32, 2, 1],
         [2 / 32, -1, 2],
         [3 / 32, 0, 2],
         [2 / 32, 1, 2]
      ],
      "two-sierra": [
         [4 / 16, 1, 0],
         [3 / 16, 2, 0],
         [1 / 16, -2, 1],
         [2 / 16, -1, 1],
         [3 / 16, 0, 1],
         [2 / 16, 1, 1],
         [1 / 16, 2, 1]
      ],
      "sierra-lite": [
         [2 / 4, 1, 0],
         [1 / 4, -1, 1],
         [1 / 4, 0, 1]
      ]
    };
    
    function findClosestRgb( palBuff, r, g, b ){

      if( palBuff instanceof ArrayBuffer === false ){
        throw new Error("palBuff was not a ArrayBuffer");
      }
      
      if( palBuff.byteLength % 3 ){
        throw new Error("palBuff byteLength must be a multiple of 3");
      }

      var palView = new Uint8Array( palBuff );

      /* coerce r,g,b to uint8s */
      r = r & 0xff;
      g = g & 0xff;
      b = b & 0xff;

      var minpos = 0;
      var mind = 256 * 256 * 256;
      var i, len, dr, dg, db, d;
      for( i=0, len=palView.length; i<len; i+=3 ){
        dr = r - palView[i];
        dg = g - palView[i+1];
        db = b - palView[i+2];
        d = dr * dr + dg * dg + db * db;
        if( d < mind ){
          mind = d;
          minpos = i / 3 | 0;
        }
      }
      
      return minpos;
      
    }
    
    function getIndexedSharp( rgbBuff, palBuff ){
      
      if( rgbBuff instanceof ArrayBuffer === false ){
        throw new Error("rgbBuff was not a ArrayBuffer" );
      }

      if( palBuff instanceof ArrayBuffer === false ){
        throw new Error("palBuff was not a ArrayBuffer")
      }

      if( rgbBuff.byteLength % 3 ){
        throw new Error("rgbBuff byteLength must be a multiple of 3");
      }

      if( palBuff.byteLength % 3 ){
        throw new Error("palBuff byteLength must be a multiple of 3");
      }

      var rgbView = new Uint8Array( rgbBuff );

      var indexedView = new Uint8Array( rgbView.length / 3 );
      
      /* todo - consider using typed array for memory??? */
      
      var memory = [], key;
      var i, j, len;
      var r, g, b, key;
      for( i=0, j=0, len=rgbView.length; i<len; ){
        r = rgbView[i++];
        g = rgbView[i++];
        b = rgbView[i++];
        key = (r << 16) | (g << 8) | b;
        if( key in memory ){
          indexedView[j++] = memory[key];
        }else{
          indexedView[j++] = memory[key] = findClosestRgb( palBuff, r, g, b );
        }
      }
      
      /**
       * @important - do NOT flush
       * memory. it may be tempting
       * but it just makes it slow.
       * let GC handle it!
       */

      return indexedView.buffer;

    }
    
    /**
     * takes a palette and rgb bytes, and generates a new
     * map of indexed colors with optional dithering, without
     * altering the original underlying buffers.
     */
    function getIndexedDithered( rgbBuff, palBuff, dither, width, height, serpentine ){
      
      if( rgbBuff instanceof ArrayBuffer === false ){
        throw new Error("rgbBuff was not an ArrayBuffer");
      }
      
      if( palBuff instanceof ArrayBuffer === false ){
        throw new Error("palBuff was not an ArrayBuffer");
      }
      
      if( rgbBuff.byteLength % 3 ){
        throw new Error("rgbBuff.byteLength was not a multiple of 3");
      }
      
      if( palBuff.byteLength % 3 ){
        throw new Error("palBuff.byteLength was not a multiple of 3");
      }

      dither += "";
      /* coerce to uint32s */
      width = width >>> 0;
      height = height >>> 0;
      serpentine = !!serpentine;

      if( width * height * 3 !== rgbBuff.byteLength ){
        throw new Error("width * height * 3 did not equal provided rgbBuff.bytelength");
      }
      
      /**
       * copy bytes to a new buffer so as not to alter the original ones.
       * the reason we do this is because the operation of dithering will
       * alter the pixels in-place as the error is spread, so getting the
       * indexed colors would require altering the original buffer.
       *
       * kernels - @see https://leeoniya.github.io/RgbQuant.js/demo/ (RgbQuant source code)
       */
      var rgbView = new Uint8Array( rgbBuff.slice() );
      var palView = new Uint8Array( palBuff.slice() );
      var indices = new Uint8Array( getIndexedSharp( rgbBuff, palBuff ) );
      
      /**
       * lut
       */
      var memory = [], key;
      
      
      /**
       * @see https://tannerhelland.com/2012/12/28/dithering-eleven-algorithms-source-code.html
       */

      var kernels = DITHER_KERNELS;

      if( dither in kernels === false ){
        throw new Error("provided dither method not found in kernels. allowed methods include: \"" + Object.keys( kernels ).join("\", \"") + "\"." );
      }

      var kernel = kernels[ dither ];
      var y, x;
      var
        pixIdx, pixR, pixG, pixB,
        palIdx, palR, palG, palB,
        errR, errG, errB,
        kIdx, kEntry, influence, xShift, yShift,
        targPixIdx
      ;

      /**
       * direction. if serpentine is off this will remain 1 always.
       * if serpentine is on this will flip back and forth with -1.
       * it will determine whether the dithering proceeds left-to-
       * right or right-to-left for each row. it must also flip the
       * "x" value for the dither kernel entry accordingly
       */
      var dir=1, tx, ty;

      for( y=0; y<height; y++ ){

        if( serpentine ){
          dir = -dir;
        }

        for( x=(dir>0?0:(width-1)); x!==(dir>0?width:-1); x=(dir>0?(x+1):(x-1)) ){

          /* get the index of the pixel */
          pixIdx = (y*width) + x;

          /* get the original r,g,b values */
          pixIdx *= 3;
          pixR = rgbView[ pixIdx ];
          pixG = rgbView[ pixIdx + 1 ];
          pixB = rgbView[ pixIdx + 2 ];
          pixIdx /= 3;
          
          /* find the most similar color (yes, this must be re-caclulated here) */
          key = (pixR << 16) | (pixG << 8) | pixB;
          if( key in memory ){
            palIdx = memory[key];
          }else{
            palIdx = memory[key] = findClosestRgb( palBuff, pixR, pixG, pixB );
          }
          
          palIdx *= 3;
          palR = palView[ palIdx ];
          palG = palView[ palIdx + 1 ];
          palB = palView[ palIdx + 2 ];
          palIdx /= 3;

          /* get the amount of discrepancy between original color and palView color */
          errR = pixR - palR;
          errG = pixG - palG;
          errB = pixB - palB;

          /* update the index in the indices */
          indices[ pixIdx ] = palIdx;

          /**
           * spread out the errors gotten earlier to the surrounding pixels
           * according to the chosen kernel
           */
          for( kIdx=0; kIdx<kernel.length; kIdx++ ){

            /* get the kernel entry */
            kEntry = kernel[ kIdx ];

            /* how much the error will influence this pixel */
            influence = kEntry[0];

            /* location of the pixel relative to original pixel */
            xShift = kEntry[1] * dir;
            yShift = kEntry[2];
            
            tx = x + xShift;
            ty = y + yShift;
            if (tx < 0 || tx >= width || ty < 0 || ty >= height){
              continue;
            }

            /* find the target pixel's index */
            targPixIdx = ((y+yShift)*width) + (x+xShift);

            /**
             * adjust the target pixel using the influence times
             * the difference for each channel. note that these
             * will be passed over later to further spread the
             * error when this pixel becomes the main pixel
             */
            targPixIdx *= 3;
            rgbView[ targPixIdx     ] = Math.min( Math.max( rgbView[ targPixIdx     ] + (errR * influence), 0 ), 255 );
            rgbView[ targPixIdx + 1 ] = Math.min( Math.max( rgbView[ targPixIdx + 1 ] + (errG * influence), 0 ), 255 );
            rgbView[ targPixIdx + 2 ] = Math.min( Math.max( rgbView[ targPixIdx + 2 ] + (errB * influence), 0 ), 255 );
            targPixIdx /= 3;
          }

        }
      }

      /* dispose of the copies (transfer not standard yet so check for it) */
      typeof rgbView.buffer.transfer === "function" && rgbView.buffer.transfer( 0 );
      typeof palView.buffer.transfer === "function" && palView.buffer.transfer( 0 );

      /**
       * @important - do NOT flush
       * memory. it may be tempting
       * but it just makes it slow.
       * let GC handle it!
       */

      return indices.buffer;

    }
    
    /**
     * if options is undefined, it is assumed
     * dithering is not desired, and the colors
     * will only be indexed. if it is an object,
     * then the fields for the object are type-
     * checked as arguments for the dithering
     * operation.
     */
    function rgb2indexed( rgbBuff, palette, options ){
      
      if( rgbBuff instanceof ArrayBuffer === false ){
        throw new Error("rgbBuff was not an ArrayBuffer");
      }
      
      if( palette instanceof GifPalette === false ){
        throw new Error("palette was not an GifPalette");
      }
      
      if( rgbBuff.byteLength % 3 ){
        throw new Error("rgbBuff.byteLength was not a multiple of 3");
      }
      
      var indices;
      var dither, width, height, serpentine;
      
      var alphaIdx, alphaColor;
      
      /**
       * if the palette has an alpha channel, we
       * need to remove it before indexing, so that
       * any colors are not accidentely set to the
       * alpha channel (which would cause wrong parts
       * of the image to be transparent). the image
       * is analyzed, the alpha color added back into
       * the palette where it was, then all of the
       * indices greater or equal to the alpha index
       * are increased by 1. this way, none of the
       * indices in the image will point to the alpha\
       * index. after this, the alpha mask can simply
       * be added by setting all of the pixels to
       * the designated alpha index. in this way we
       * can accomodate an alpha channel without know-
       * ing the locations of the transparent pixels
       * yet.
       */
      if( palette.hasAlpha ){
        alphaIdx = palette.alphaIdx;
        alphaColor = palette.colors[ alphaIdx ];
        palette.removeColor( alphaColor );
      }

      /* if the palette is padded, the indexing functions 
      below may mistakenly match pixels with the empty color
      table entries, which is wrong, so the buffer needs to
      be truncated to the non-padded length here */
      var palBuff = palette.buffer.slice( 0, palette.colors.length * 3 );
      
      if( typeof options === "undefined" ){

        /* just index */
        indices = getIndexedSharp( rgbBuff, palBuff );

      }else{

        dither = options.dither;
        width = options.width;
        height = options.height;
        serpentine = options.serpentine;

        /* dither */
        if( dither ){
          indices = getIndexedDithered( rgbBuff, palBuff, dither, width, height, serpentine );
        }else{
          /* just index */
          indices = getIndexedSharp( rgbBuff, palBuff );
        }

      }
      
      var i, indicesView;
      if( palette.hasAlpha ){
        
        indicesView = new Uint8Array( indices );
        
        for( i=0; i<indicesView.length; i++ ){
          /**
           * the boolean will coerce to a 1 or 0,
           * adding to the index if it is greater
           * or equal to the alpha index
           */
          indicesView[i] += indicesView[i] >= alphaIdx;
        }
      
        /* add the alpha index back to the color palette */
        palette.addColor( alphaColor );
      
      }
      
      return indices;

    }

    /**
     * create an RGB Uint8Array from a RGB palette and indices
     */
    function indexed2rgb( indicesBuff, palette ){

      if( indicesBuff instanceof ArrayBuffer === false ){
        throw new Error("indicesBuff was not an ArrayBuffer");
      }
      
      if( palette instanceof GifPalette === false ){
        throw new Error("palette was not an GifPalette");
      }
      
      var palBuff = palette.buffer;
      var palView = new Uint8Array( palBuff );
      var indices = new Uint8Array( indicesBuff );
      
      if( palView.length % 3 ){
        throw new Error("palView length must be a multiple of 3");
      }

      var rgbView = new Uint8Array( indices.length * 3 );

      var i, offs, palIdx, r, g, b;
      for( i=0, offs=0; i<indices.length; i++ ){
        palIdx = indices[i];
        r = palView[ (palIdx * 3) + 0 ];
        g = palView[ (palIdx * 3) + 1 ];
        b = palView[ (palIdx * 3) + 2 ];
        rgbView[ offs++ ] = r;
        rgbView[ offs++ ] = g;
        rgbView[ offs++ ] = b;
      }

      return rgbView.buffer;

    }
    
    return {
      DITHER_KERNELS,
      findClosestRgb,
      getIndexedSharp,
      getIndexedDithered,
      rgb2indexed,
      indexed2rgb,
    };
    
  }();
  
  const {
    IndexWorkerPool,
  } = function(){  

    "use strict";
    
    const INDEX_WORKER_POOL_AUTOCLOSE_TIMEOUT = 20000;

    class IndexWorker{
      
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
      
      async rgb2indexed( rgbBuff, palette, options ){
        return await this.#doTask( "rgb2indexed", [ rgbBuff, palette.toTransferable(), options ] );
      }
      
      async indexed2rgb( indicesBuff, palette ){
        return await this.#doTask( "indexed2rgb", [ indicesBuff, palette.toTransferable() ] );
      }
      
      constructor(){
        
        this.#worker = new Worker( URL.createObjectURL( new Blob([`
        
          const DITHER_KERNELS = ${ JSON.stringify( DITHER_KERNELS ) };
        
          ${ GifPalette }
          
          ${ findClosestRgb }
          
          ${ getIndexedSharp }
          ${ getIndexedDithered }
          
          ${ rgb2indexed }
          ${ indexed2rgb }
        
          onmessage = ({data}) => {
            
            let [
              method,
              args,
            ] = data;

            /* convert second arg back to GifPalette */
            
            args[1] = GifPalette.fromTransferable( args[1] );
            
            if( method === "rgb2indexed" ){
              let result = rgb2indexed(...args);
              postMessage( [ result ], [ result ] );
            }else if( method === "indexed2rgb" ){
              let result = indexed2rgb(...args);
              postMessage( [ result ], [ result ] );
            }else{
              throw new Error("invalid method provided");
            }
            
          };
          
        `], {type:"text/javascript"}) ) );
        
      }
      
    }
    
    class IndexWorkerPool{
      
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
      
      static WORKER_CLASS = IndexWorker;
      
      async rgb2indexed(...args){
        
        let worker = await this.#getNextFreeWorker();

        try{
          return await worker.rgb2indexed(...args);
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
          }, INDEX_WORKER_POOL_AUTOCLOSE_TIMEOUT );
        }
      }
      
      async indexed2rgb(...args){
        
        let worker = await this.#getNextFreeWorker();
        
        try{
          return await worker.indexed2rgb(...args);
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
          }, INDEX_WORKER_POOL_AUTOCLOSE_TIMEOUT );
        }
      }
      
    }
    
    return {
      IndexWorkerPool,
    };
    
  }();
  
  const {
    rgb2indexedAsync,
    indexed2rgbAsync,
  } = function(){
    
    "use strict";
    
    const INTERNAL_POOL_MAX_CONC = ( globalThis.navigator?.hardwareConcurrency || 1 ) * 4;
    
    let INTERNAL_POOL = null;
    
    async function rgb2indexedAsync(...args){
      if( INTERNAL_POOL === null ){
        INTERNAL_POOL = new IndexWorkerPool( INTERNAL_POOL_MAX_CONC );
      }
      return await INTERNAL_POOL.rgb2indexed(...args);
    }
    
    async function indexed2rgbAsync(...args){
      if( INTERNAL_POOL === null ){
        INTERNAL_POOL = new IndexWorkerPool( INTERNAL_POOL_MAX_CONC );
      }
      return await INTERNAL_POOL.indexed2rgb(...args);
    }
    
    return {
      rgb2indexedAsync,
      indexed2rgbAsync,
    };
    
  }();
  
  return {
    rgb2indexed,
    indexed2rgb,
    rgb2indexedAsync,
    indexed2rgbAsync,
  };
  
}()