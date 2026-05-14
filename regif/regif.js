var {
  ReGif,
} = function(){
  
  "use strict";
   
  const toSubBlocks = (buff) => {
    
    if( buff instanceof ArrayBuffer === false ){
      throw new Error("buff was not an ArrayBuffer");
    }
    
    let slices = [];
    
    for( let i=0; i<buff.byteLength; i+=0xff ){
      let slice = buff.slice( i, i + 0xff );
      let size = slice.byteLength;
      let view = new Uint8Array( size + 1 );
      view[0] = size;
      view.set( new Uint8Array( slice ), 1 );
      slices.push( view.buffer );
    }
    
    return slices;
    
  };
  
  
  
  
  
  
  
  class DataBlock{}
  
  class Trailer extends DataBlock{
    
    #buffer = null;
    
    get buffer(){
      return this.#buffer.slice();
    }
    
    constructor(){
      super();
      this.#buffer = new Uint8Array( [ ";".charCodeAt(0) ] ).buffer;
    }
    
  }
  
  class Gif87aHeader extends DataBlock{
    
    #buffer = null;
    
    get buffer(){
      return this.#buffer.slice();
    }
    
    constructor(){
      super();
      this.#buffer = new Uint8Array( "GIF87a".split("").map((c)=>c.charCodeAt()) ).buffer;
    }
    
  }
  
  class Gif89aHeader extends DataBlock{
    
    #buffer = null;
    
    get buffer(){
      return this.#buffer.slice();
    }
    
    constructor(){
      super();
      this.#buffer = new Uint8Array( "GIF89a".split("").map((c)=>c.charCodeAt()) ).buffer;
    }
    
  }
  
  class ColorTable extends DataBlock{
    
    #buffer = null;
    
    get buffer(){
      return this.#buffer.slice();
    }
    
    constructor( palBuff ){
      
      super();
      
      if( palBuff instanceof ArrayBuffer === false ){
        throw new Error("palBuff was not an ArrayBuffer");
      }
      
      /* check size */
      let allowedSizes = [ 2, 4, 8, 16, 32, 64, 128, 256 ];
      if( allowedSizes.indexOf( palBuff.byteLength / 3 ) === -1 ){
        throw new Error("invalid palBuff byteLength");
      }
      
      this.#buffer = palBuff.slice();
      
    }
    
  }
  
  class LogicalScreenDescriptor extends DataBlock{
    
    #width = 1;
    #height = 1;
    #sorted = false;
    #bgColorIdx = 0;
    #pxAspRat = 0;
    #colorRes = 7;
    #useGct = false;
    #gctSize = 2;
    
    get width(){ return this.#width }
    get height(){ return this.#height }
    get sorted(){ return this.#sorted }
    get bgColorIdx(){ return this.#bgColorIdx }
    get pxAspRat(){ return this.#pxAspRat }
    get colorRes(){ return this.#colorRes }
    get useGct(){ return this.#useGct }
    get gctSize(){ return this.#gctSize }
    
    set width( any ){
      this.#width = Math.max( 1, Math.min( 0xffff, any >>> 0 )  );
    }
    set height( any ){
      this.#height = Math.max( 1, Math.min( 0xffff, any >>> 0 )  );
    }
    set sorted( any ){
      this.#sorted = !!any;
    }
    set bgColorIdx( any ){
      this.#bgColorIdx = Math.min( 0xff, any >>> 0 );
    }
    set pxAspRat( any ){
      this.#pxAspRat = Math.min( 0xff, any >>> 0 );
    }
    set colorRes( any ){
      this.#colorRes = Math.min( any >>> 0, 0x07 );
    }
    set useGct( any ){
      this.#useGct = !!any;
    }
    set gctSize( any ){
      if( [ 2, 4, 8, 16, 32, 64, 128, 256, ].indexOf( any ) === -1 ){
        throw new Error("invalid gctSize");
      }
      this.#gctSize = any;
    }
    
    get buffer(){
      
      let {
        width,
        height,
        sorted,
        bgColorIdx,
        pxAspRat,
        colorRes,
        useGct,
        gctSize,
      } = this;

      if( useGct ){
        gctSize = (
          gctSize === 2 ? 0 :
          gctSize === 4 ? 1 :
          gctSize === 8 ? 2 :
          gctSize === 16 ? 3 :
          gctSize === 32 ? 4 :
          gctSize === 64 ? 5 :
          gctSize === 128 ? 6 :
          7
        );
      }else{
        gctSize = 0;
      }

      useGct *= 1;
      sorted *= 1;

      let packedFieldByte = (
        (useGct << 7) |
        (colorRes << 4) |
        (sorted << 3) |
        (gctSize)
      );
      
      let bytes = [
        (width >> 0) & 0xff,
        (width >> 8) & 0xff,
        (height >> 0) & 0xff,
        (height >> 8) & 0xff,
        packedFieldByte,
        bgColorIdx,
        pxAspRat
      ];

      return new Uint8Array( bytes ).buffer;
    
    }
  
  }
  
  class ImageData extends DataBlock{

    #width = 1;
    #height = 1;
    #indicesBuff = new ArrayBuffer(1);
    #palSize = 2;
    
    set width( any ){
      this.#width = Math.max( 1, Math.min( 0xffff, any >>> 0 )  );
    }
    set height( any ){
      this.#height = Math.max( 1, Math.min( 0xffff, any >>> 0 )  );
    }
    set indicesBuff( any ){
      if( any instanceof ArrayBuffer === false ){
        throw new Error("any was not an ArrayBuffer");
      }
      this.#indicesBuff = any.slice();
    }
    set palSize( any ){
      if( [ 2, 4, 8, 16, 32, 64, 128, 256, ].indexOf( any ) === -1 ){
        throw "invalid palSize";
      }
      this.#palSize = any;
    }

    get width(){ return this.#width }
    get height(){ return this.#height }
    get indicesBuff(){ return this.#indicesBuff }
    get palSize(){ return this.#palSize }

    get buffer(){
      
      let {
        width,
        height,
        indicesBuff,
        palSize,
      } = this;

      /**
       * set pixels to new ui8 in case there is a size mismatch
       */
      let indicesView = new Uint8Array( width * height );
      indicesView.set( new Uint8Array( indicesBuff.slice( 0, indicesView.length ) ), 0 );
      
      let initCodeSize = (
        palSize === 256 ? 8 :
        palSize === 128 ? 7 :
        palSize === 64 ? 6 :
        palSize === 32 ? 5 :
        palSize === 16 ? 4 :
        palSize === 8 ? 3 :
        2
      );
      
      /**
       * double check indices
       */
      for( let i of indicesView ){
        if( i > palSize - 1 ){
          throw new Error("pixel index exceeded palette size");
        }
      }

      return lzwEncode( width, height, indicesView, initCodeSize );

    }

  }
  
  class ImageDescriptor extends DataBlock{

    #left = 0;
    #top = 0;
    #width = 1;
    #height = 1;
    #interlaced = false;
    #sorted = false;
    #useLct = false;
    #palSize = 2;
    
    set left( any ){
      this.#left = Math.max( 1, Math.min( 0xffff, any >>> 0 ) );
    }
    set top( any ){
      this.#top = Math.max( 1, Math.min( 0xffff, any >>> 0 ) );
    }
    set width( any ){
      this.#width = Math.max( 1, Math.min( 0xffff, any >>> 0 ) );
    }
    set height( any ){
      this.#height = Math.max( 1, Math.min( 0xffff, any >>> 0 ) );
    }
    set interlaced( any ){
      this.#interlaced = !!any;
    }
    set sorted( any ){
      this.#sorted = !!any;
    }
    set useLct( any ){
      this.#useLct = !!any;
    }
    set palSize( any ){
      if( [ 2, 4, 8, 16, 32, 64, 128, 256, ].indexOf( any ) === -1 ){
        throw "invalid palSize";
      }
      this.#palSize = any;
    }
    
    get left(){ return this.#left }
    get top(){ return this.#top }
    get width(){ return this.#width }
    get height(){ return this.#height }
    get interlaced(){ return this.#interlaced }
    get sorted(){ return this.#sorted }
    get useLct(){ return this.#useLct }
    get palSize(){ return this.#palSize }

    /**
     * @important note - if the LCT is set to true,
     * then the value for this must match the LCT.
     * otherwise, the value for this must match the
     * GCT. since this class does not have direct
     * access to the GCT, in the case that it uses
     * the GCT the palSize must be arbitrarily set
     * externally from within the addFrame method
     * that created it immediately after instantia-
     * tion and before the buffer is accessed.
     */
    get buffer(){

      let {
        left,
        top,
        width,
        height,
        useLct,
        interlaced,
        sorted,
        palSize,
      } = this;

      palSize = (
        palSize === 2 ? 0 :
        palSize === 4 ? 1 :
        palSize === 8 ? 2 :
        palSize === 16 ? 3 :
        palSize === 32 ? 4 :
        palSize === 64 ? 5 :
        palSize === 128 ? 6 :
        7
      );

      useLct *= 1;
      interlaced *= 1;
      sorted *= 1;

      let packedFieldByte = (
        ( useLct << 7 ) |
        ( interlaced << 6 ) |
        ( sorted << 5 ) |
        ( palSize )
      );

      let bytes = [
        0x2c,               /* image seperator (always 2c) */
        (left >> 0) & 0xff,
        (left >> 8) & 0xff,
        (top >> 0) & 0xff,
        (top >> 8) & 0xff,
        (width >> 0) & 0xff,
        (width >> 8) & 0xff,
        (height >> 0) & 0xff,
        (height >> 8) & 0xff,
        packedFieldByte,
      ];

      return new Uint8Array( bytes ).buffer;

    }

  }
  
  const makeFrame87a = (options, gifObj, gifColorTab) => {
    
    let imgDesc, colorTab, imgData;

    /**
     * frame defaults:
     * top.................0
     * left................0
     * width...............gif width
     * height..............gif height
     */
    
    if( !options.colorTab && !gifColorTab ){
      /**
       * if there is no LCT nor a GCT to fall back
       * to, there will be no palette for the decoder
       * to use!
       */
      throw new Error("neither frame nor gif had a defined palette");
    }
    
    /* obtain options */
    
    let left = "left" in options ? options.left : 0;
    let top = "top" in options ? options.top : 0;
    let width = "width" in options ? options.width : gifObj.width;
    let height = "height" in options ? options.height : gifObj.height;
    
    let useLct = !!options.colorTab;
    let sorted = "sorted" in options ? !!options.sorted : gifObj.sorted;
    let interlaced = !!options.interlaced;
    
    colorTab = "colorTab" in options ? options.colorTab : gifColorTab;
    
    if( colorTab instanceof ColorTable === false ){
      throw new Error("colorTab was not a ColorTable");
    }
    
    /* set up image descriptor */
    
    imgDesc = new ImageDescriptor();
    
    imgDesc.left = left;
    imgDesc.top = top;
    imgDesc.width = width;
    imgDesc.height = height;
    
    imgDesc.useLct = useLct;
    imgDesc.sorted = sorted;
    imgDesc.interlaced = interlaced;
    imgDesc.palSize = colorTab ? (colorTab.buffer.byteLength/3) : (gifColorTab.buffer.byteLength/3);
    
    /* create image data */
    
    imgData = new ImageData();

    imgData.width = imgDesc.width;
    imgData.height = imgDesc.height;
    imgData.indicesBuff = options.indicesBuff;
    imgData.palSize = colorTab ? (colorTab.buffer.byteLength/3) : (gifColorTab.buffer.byteLength/3);
    
    /* generate buffers and push data */
    
    let buffs = [];
    
    buffs.push( imgDesc.buffer );
    
    if( useLct ){
      buffs.push( colorTab.buffer );
    }
    
    buffs.push( imgData.buffer );
    
    
    /* combine and return as one */
    
    return concatArrayBuffers( buffs );
    
  };
  
  
  /**
   *
   *  Gif87a({  
   *    width
   *    height
   *    sorted
   *    bgColorIdx
   *    pxAspRat
   *    colorRes
   *    palette
   *  })
   *
   *  Gif87a.writeFrame({
   *    left
   *    top
   *    width
   *    height
   *    indicesBuff
   *    palette
   *    interlaced
   *    sorted
   *  })
   *
   *  Gif87a.finish()
   *
   */
  class Gif87a{
    
    #header = new Gif87aHeader();
    #lsd = new LogicalScreenDescriptor();
    #colorTab = null;
    #trailer = new Trailer();
    
    constructor( options ){
      
      let {
        width,
        height,
        sorted,
        bgColorIdx,
        pxAspRat,
        colorRes,
        palette,
      } = options || {};
      
      this.#lsd.width = width;
      this.#lsd.height = height;
      this.#lsd.sorted = sorted;
      this.#lsd.bgColorIdx = bgColorIdx;
      this.#lsd.pxAspRat = pxAspRat;
      this.#lsd.colorRes = colorRes;
    
      if( palette ){
        if( palette instanceof GifPalette === false ){
          throw new Error("if truthy, palette must be a GifPalette" );
        }
        this.#colorTab = new ColorTable( palette.buffer );
        this.#lsd.useGct = true;
        this.#lsd.gctSize = this.#colorTab.buffer.byteLength/3;
      }else{
        this.#colorTab = null;
        this.#lsd.useGct = false;
        this.#lsd.gctSize = 2;
      }
    
    }
    
    get width(){ return this.#lsd.width }
    get height(){ return this.#lsd.height }
    get sorted(){ return this.#lsd.sorted }
    get bgColorIdx(){ return this.#lsd.bgColorIdx }
    get pxAspRat(){ return this.#lsd.pxAspRat }
    get colorRes(){ return this.#lsd.colorRes }
    get colorTab(){ return this.#colorTab }
    
    ondata = null;
    
    #started = false;
    #ended = false;
    
    #emit( buff ){
      if( buff instanceof ArrayBuffer === false ){
        throw new Error("buff was not an ArrayBuffer");
      }
      if( typeof this.ondata === "function" ){
        this.ondata( buff );
      }else{
        console.warn("no 'ondata' handler; disposing buffer.");
        buff.transfer?.( 0 );
      }
    }
    
    #emitHeaders(){
      let buffs = [];
      buffs.push( this.#header.buffer );
      buffs.push( this.#lsd.buffer );
      if( this.#colorTab ){
        buffs.push( this.#colorTab.buffer );
      }
      this.#emit( concatArrayBuffers( buffs ) );
    }
    
    #emitFooters(){
      this.#emit( this.#trailer.buffer );
    }
    
    writeFrame( options ){
      
      if( this.#ended ){
        throw new Error("cannot write frame after gif stream has ended");
      }
      
      if( !this.#started ){
        this.#emitHeaders();
        this.#started = true;
      }
      
      options = {...options};
      if( options.palette ){
        options.colorTab = new ColorTable( options.palette.buffer );
        delete options.palette;
      }
      
      this.#emit( makeFrame87a( options, this, this.#colorTab ) );
      
    }
    
    finish(){
      if( this.#ended ){
        throw new Error("cannot call finish after gif stream has ended");
      }
      if( !this.#started ){
        this.#emitHeaders();
        this.#started = true;
      }
      this.#emitFooters();
      this.#ended = true;
    }
    
  }
  
  
  
  
  
  /**
   * @see https://www.theimage.com/animation/pages/disposal.html
   * disposal methods ( 0 - 7 )
   *    0   (n/a)
   *    1   no disposal
   *    2   restore background
   *    3   restore previous
   *    4   (n/a)
   *    5   (n/a)
   *    6   (n/a)
   *    7   (n/a)
   */
  
  class GraphicCtrlExt extends DataBlock{
    
    #disposalMethod = 0;
    #needsUserInput = false;
    #hasAlpha = false;
    #displayDuration = 0;       /* set in 100ths of a second */
    #alphaIdx = 0;
    
    set disposalMethod( any ){
      this.#disposalMethod = Math.min( any & 0xff, 0x07 );
    }
    set needsUserInput( any ){
      this.#needsUserInput = !!any;
    }
    set hasAlpha( any ){
      this.#hasAlpha = !!any;
    }
    set displayDuration( any ){
      this.#displayDuration = any & 0xffff;
    }
    set alphaIdx( any ){
      this.#alphaIdx = any & 0xff;
    }
    
    get disposalMethod(){ return this.#disposalMethod }
    get needsUserInput(){ return this.#needsUserInput }
    get hasAlpha(){ return this.#hasAlpha }
    get displayDuration(){ return this.#displayDuration }
    get alphaIdx(){ return this.#alphaIdx }
    
    get buffer(){
      
      let {
        disposalMethod,
        needsUserInput,
        hasAlpha,
        displayDuration,
        alphaIdx
      } = this;
      
      needsUserInput *= 1;
      hasAlpha *= 1;
      
      let packedFieldByte = (
        ( disposalMethod << 2 ) |
        ( needsUserInput << 1 ) |
        ( hasAlpha )
      );
      
      let bytes = [
        0x21,         /* extension introducer */
        0xf9,         /* gce label */
        0x04,         /* byte size */
        packedFieldByte,
        (displayDuration >> 0) & 0xff,
        (displayDuration >> 8) & 0xff,
        alphaIdx,
        0x00,         /* block terminator */
      ];
      
      return new Uint8Array( bytes ).buffer;
      
    }
    
  }
  
  /**
   * important note - the netscape app extension
   * defines how many times the gif will loop
   * after the first run, so if this is set to 
   * loop 2 times, the gif will actually play 3
   * times.
   */
  class Netscape_2_0_AppExt extends DataBlock{
    
    #loopCount = 0;
    
    set loopCount( any ){
      this.#loopCount = any & 0xffff;
    }
    
    get loopCount(){ return this.#loopCount }
    
    get buffer(){
      let { loopCount } = this;
      let bytes = [
        0x21,                           /* extension marker */
        0xff,                           /* app extension label */
        0x0b,                           /* length of app block (11) */
        ..."NETSCAPE".split("").map((c)=>c.charCodeAt()),
        ..."2.0".split("").map((c)=>c.charCodeAt()),
        0x03,
        0x01,
        (loopCount >> 0) & 0xff,        /* loop count ( 0 - 0xffff) */
        (loopCount >> 8) & 0xff,
        0x00,                           /* block terminator */
      ];
      return new Uint8Array( bytes ).buffer;
    }
    
  }
  
  
  
  /**
   * @see https://www.w3.org/Graphics/GIF/spec-gif89a.txt (section 25)
   * - textual data are encoded in 7-bit printable ascii characters
   *
   */
  class PlaintextExt extends DataBlock{
    
    #text = "";
    
    #left = 0;
    #top = 0;
    #width = 0xffff;
    #height = 0xffff;
    
    #cellWidth = 8;
    #cellHeight = 16;
    
    #bgColorIdx = 0;
    #fgColorIdx = 1;
    
    set text( any ){
      this.#text = any + "";
    }
    set left( any ){
      this.#left = any & 0xffff;
    }
    set top( any ){
      this.#top = any & 0xffff;
    }
    set width( any ){
      this.#width = any & 0xffff;
    }
    set height( any ){
      this.#height = any & 0xffff;
    }
    set cellWidth( any ){
      this.#cellWidth = any & 0xff;
    }
    set cellHeight( any ){
      this.#cellHeight = any & 0xff;
    }
    set bgColorIdx( any ){
      this.#bgColorIdx = any & 0xff;
    }
    set fgColorIdx( any ){
      this.#fgColorIdx = any & 0xff;
    }
    
    get text(){ return this.#text }
    get left(){ return this.#left }
    get top(){ return this.#top }
    get width(){ return this.#width }
    get height(){ return this.#height }
    get cellWidth(){ return this.#cellWidth }
    get cellHeight(){ return this.#cellHeight }
    get bgColorIdx(){ return this.#bgColorIdx }
    get fgColorIdx(){ return this.#fgColorIdx }
    
    get buffer(){
      
      let {
        text,
        left, top, width, height,
        cellWidth, cellHeight,
        bgColorIdx, fgColorIdx,
      } = this;
       
      let buffs = [];
      
      let bytes = [
        
        0x21,     /* extension introducer */
        0x01,     /* plain text label */
        0x0c,     /* block size (12) */
        
        (left >> 0) & 0xff,
        (left >> 8) & 0xff,
        
        (top >> 0) & 0xff,
        (top >> 8) & 0xff,
        
        (width >> 0) & 0xff,
        (width >> 8) & 0xff,
        
        (height >> 0) & 0xff,
        (height >> 8) & 0xff,
        
        cellWidth,
        cellHeight,
        
        fgColorIdx,
        bgColorIdx,
        
      ];
      
      buffs.push( new Uint8Array( bytes ).buffer );
      
      let textData = new Uint8Array( text.split("").map( (ch) => ch.charCodeAt() & 0xff ) ).buffer;
      
      let subBlocks = toSubBlocks( textData );
      
      for( let subBlock of subBlocks ){
        buffs.push( subBlock );
      }
      
      /* push block terminator */
      buffs.push( new Uint8Array(1).buffer );
      
      return concatArrayBuffers( buffs );
      
    }
    
  }
  
  class CommentExt extends DataBlock{
    
    #text = "";
    
    set text( any ){
      this.#text = any + "";
    }
    
    get text(){ return this.#text }
    
    get buffer(){
      
      let {
        text,
      } = this;
      
      let buffs = [];
      let bytes = [
        0x21,   /* extension introducer */
        0xfe,   /* comment label */
      ];
      
      buffs.push( new Uint8Array( bytes ).buffer );
      
      let textData = new Uint8Array( text.split("").map( (ch) => ch.charCodeAt() & 0xff ) ).buffer;
      
      let subBlocks = toSubBlocks( textData );
      
      for( let subBlock of subBlocks ){
        buffs.push( subBlock );
      }
      
      /* push block terminator */
      buffs.push( new Uint8Array(1).buffer );
      
      return concatArrayBuffers( buffs );
      
    }
    
  }
  
  const makeFrame89a = (options, gifObj, gifColorTab) => {
    
    let gce, imgDesc, colorTab, imgData;

    /**
     * frame defaults:
     * top.................0
     * left................0
     * width...............gif width
     * height..............gif height
     */
    
    if( !options.colorTab && !gifColorTab ){
      /**
       * if there is no LCT nor a GCT to fall back
       * to, there will be no palette for the decoder
       * to use!
       */
      throw new Error("neither frame nor gif had a defined palette");
    }
    
    /* obtain options */
    
    let left = "left" in options ? options.left : 0;
    let top = "top" in options ? options.top : 0;
    let width = "width" in options ? options.width : gifObj.width;
    let height = "height" in options ? options.height : gifObj.height;
    
    let useLct = !!options.colorTab;
    let sorted = "sorted" in options ? !!options.sorted : gifObj.sorted;
    let interlaced = !!options.interlaced;
    
    /* gif89a-only properties */
    let disposalMethod = "disposalMethod" in options ? options.disposalMethod : 0;
    let needsUserInput = "needsUserInput" in options ? options.needsUserInput : false;
    let displayDuration = "displayDuration" in options ? options.displayDuration : 0;  
    let hasAlpha = "hasAlpha" in options ? options.hasAlpha : false;
    let alphaIdx = "alphaIdx" in options ? options.alphaIdx : 0;
    
    colorTab = "colorTab" in options ? options.colorTab : gifColorTab;
    
    if( colorTab instanceof ColorTable === false ){
      throw new Error("colorTab was not a ColorTable");
    }
    
    
    
    
    
    /**
     * set up gce
     *
     * note - even though GCE is gif89 only, always emit
     * because gif timing will vary among browsers if it
     * is not included
     */
    gce = new GraphicCtrlExt();
    gce.disposalMethod = disposalMethod;
    gce.needsUserInput = needsUserInput;
    gce.displayDuration = Math.round(displayDuration / 10);   /* convert milliseconds to centiseconds (gifs use centiseconds) */
    gce.hasAlpha = hasAlpha;
    gce.alphaIdx = alphaIdx;
    
    /* set up image descriptor */
    
    imgDesc = new ImageDescriptor();
    
    imgDesc.left = left;
    imgDesc.top = top;
    imgDesc.width = width;
    imgDesc.height = height;
    
    imgDesc.useLct = useLct;
    imgDesc.sorted = sorted;
    imgDesc.interlaced = interlaced;
    imgDesc.palSize = colorTab ? (colorTab.buffer.byteLength/3) : (gifColorTab.buffer.byteLength/3);
    
    /* create image data */
    
    imgData = new ImageData();

    imgData.width = imgDesc.width;
    imgData.height = imgDesc.height;
    imgData.indicesBuff = options.indicesBuff;
    imgData.palSize = colorTab ? (colorTab.buffer.byteLength/3) : (gifColorTab.buffer.byteLength/3);
    
    /* generate buffers and push data */
    
    let buffs = [];
    
    buffs.push( gce.buffer );
    buffs.push( imgDesc.buffer );
    
    if( useLct ){
      buffs.push( colorTab.buffer );
    }
    
    buffs.push( imgData.buffer );
    
    
    /* combine and return as one */
    
    return concatArrayBuffers( buffs );
    
  };
  
  
  
  /**
   *
   *  Gif89a({  
   *    width
   *    height
   *    sorted
   *    bgColorIdx
   *    pxAspRat
   *    colorRes
   *    palette
   *  })
   *
   *  Gif89a.writeFrame({
   *    left
   *    top
   *    width
   *    height
   *    indices
   *    palette
   *    interlaced
   *    sorted
   *    disposalMethod
   *    needsUserInput
   *    displayDuration
   *    hasAlpha
   *    alphaIdx
   *  })
   *
   *  Gif89a.writePlaintext({
   *    text
   *    left
   *    top
   *    width
   *    height
   *    cellWidth
   *    cellHeight
   *    bgColorIdx
   *    fgColorIdx
   *  })
   *
   *  Gif89a.writeComment({
   *    text
   *  })
   *
   *  Gif89a.finish()
   *
   */
  class Gif89a{
    
    #header = new Gif89aHeader();
    #lsd = new LogicalScreenDescriptor();
    #colorTab = null;
    #trailer = new Trailer();
    #playCount = 1;
    
    constructor( options ){
      
      let {
        playCount,
        width,
        height,
        sorted,
        bgColorIdx,
        pxAspRat,
        colorRes,
        palette,
      } = options || {};
      
      this.#playCount = Math.min( playCount >>> 0, 0xffff + 1 );
      this.#lsd.width = width;
      this.#lsd.height = height;
      this.#lsd.sorted = sorted;
      this.#lsd.bgColorIdx = bgColorIdx;
      this.#lsd.pxAspRat = pxAspRat;
      this.#lsd.colorRes = colorRes;
      
      if( palette ){
        if( palette instanceof GifPalette === false ){
          throw new Error("if truthy, palette must be a GifPalette" );
        }
        this.#colorTab = new ColorTable( palette.buffer );
        this.#lsd.useGct = true;
        this.#lsd.gctSize = this.#colorTab.buffer.byteLength/3;
      }else{
        this.#colorTab = null;
        this.#lsd.useGct = false;
        this.#lsd.gctSize = 2;
      }
    
    }
    
    get playCount(){ return this.#playCount }
    get width(){ return this.#lsd.width }
    get height(){ return this.#lsd.height }
    get sorted(){ return this.#lsd.sorted }
    get bgColorIdx(){ return this.#lsd.bgColorIdx }
    get pxAspRat(){ return this.#lsd.pxAspRat }
    get colorRes(){ return this.#lsd.colorRes }
    get colorTab(){ return this.#colorTab }
    
    ondata = null;
    
    #started = false;
    #ended = false;
    
    #emit( buff ){
      if( buff instanceof ArrayBuffer === false ){
        throw new Error("buff was not an ArrayBuffer");
      }
      if( typeof this.ondata === "function" ){
        this.ondata( buff );
      }else{
        console.warn("no 'ondata' handler; disposing buffer.");
        buff.transfer?.( 0 );
      }
    }
    
    #emitHeaders(){
      let buffs = [];
      buffs.push( this.#header.buffer );
      buffs.push( this.#lsd.buffer );
      if( this.#colorTab ){
        buffs.push( this.#colorTab.buffer );
      }
      /**
       * only emit the app ext if the playcount is not 1.
       * since the Netscape App Extension stores the value
       * as the "number of replays after the first play",
       * we must subtract 1 from the play count if it is not
       * 0. note that as per the spec, a value of 0 indicates
       * infinite plays.
       **/
      if( this.#playCount !== 1 ){
        let ext = new Netscape_2_0_AppExt();
        ext.loopCount = Math.max( 0, this.#playCount - 1 );
        buffs.push( ext.buffer );
      }
      this.#emit( concatArrayBuffers( buffs ) );
    }
    
    #emitFooters(){
      this.#emit( this.#trailer.buffer );
    }
    
    writeFrame( options ){
      
      if( this.#ended ){
        throw new Error("cannot write frame after gif stream has ended");
      }
      
      if( !this.#started ){
        this.#emitHeaders();
        this.#started = true;
      }
      
      options = {...options};
      if( options.palette ){
        options.colorTab = new ColorTable( options.palette.buffer );
        delete options.palette;
      }
      
      this.#emit( makeFrame89a( options, this, this.#colorTab ) );
      
    }
    
    writePlaintext( options ){
      
      if( this.#ended ){
        throw new Error("cannot write frame after gif stream has ended");
      }
      
      if( !this.#started ){
        this.#emitHeaders();
        this.#started = true;
      }
      
      let {
        text,
        left,
        top,
        width,
        height,
        cellWidth,
        cellHeight,
        bgColorIdx,
        fgColorIdx,
      } = options || {};
      
      let ptExt = new PlaintextExt();

      ptExt.text = text;
      ptExt.left = left;
      ptExt.top = top;
      ptExt.width = width;
      ptExt.height = height;
      ptExt.cellWidth = cellWidth;
      ptExt.cellHeight = cellHeight;
      ptExt.bgColorIdx = bgColorIdx;
      ptExt.fgColorIdx = fgColorIdx;
      
      this.#emit( ptExt.buffer );
      
    }
    
    writeComment( options ){
      
      let {
        text,
      } = options || {};
      
      let cmtExt = new CommentExt();
      
      cmtExt.text = text;
      
      this.#emit( cmtExt.buffer );
        
    }
    
    finish(){
      if( this.#ended ){
        throw new Error("cannot call finish after gif stream has ended");
      }
      if( !this.#started ){
        this.#emitHeaders();
        this.#started = true;
      }
      this.#emitFooters();
      this.#ended = true;
    }
    
  }
  
  return {
    ReGif: {
      
      Gif87a,
      Gif89a,
      
      // gifParts : {
        // spec87a : {
          // Gif87aHeader,
          // LogicalScreenDescriptor,
          // get GifPalette(){
            // return globalThis.GifPalette
          // },
          // ImageDescriptor,
          // ImageData,
          // Trailer,
        // },
        // spec89a : {
          // Gif89aHeader,
          // Netscape_2_0_AppExt,
          // GraphicCtrlExt,
          // PlaintextExt,
          // CommentExt,
        // },
      // },
      
    }
  };
  
}()