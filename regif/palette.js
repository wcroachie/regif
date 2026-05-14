class GifPalette{

  #uniqueColors = {};
  #alphaIdx = null;
  
  #updateOrder(){
    let keys = [];
    for( let key in this.#uniqueColors ){
      keys.push( key );
      delete this.#uniqueColors[ key ];
    }
    keys.sort( (a,b) => parseInt(a.slice(1),16) - parseInt(b.slice(1),16) );
    for( let key of keys ){
      this.#uniqueColors[ key ] = true;
    }
  }
  
  addColor( any ){
    /* coerce to hex color */
    let hex = any + "";
    if( !hex.match(/^#[0-9a-fA-F]{6}$/g) ){
      hex = "#000000";
    }
    this.#uniqueColors[ hex ] = true;
    this.#updateOrder();
  }
  
  removeColor( any ){
    any += "";
    delete this.#uniqueColors[ any ];
    this.#updateOrder();
  }
  
  clear(){
    this.#uniqueColors = {};
    this.#alphaIdx = null;
  }
  
  get colors(){
    return Object.keys( this.#uniqueColors );
  }
  
  set alphaIdx( val ){
    val = val >>> 0;
    if( val > this.colors.length ){
      throw new Error("provided alphaIdx larger than the allowed range");
    }
    this.#alphaIdx = val;
  }
  
  get alphaIdx(){
    return this.#alphaIdx;
  }
  
  deleteAlphaIdx(){
    this.#alphaIdx = null;
  }
  
  get hasAlpha(){
    return this.#alphaIdx !== null;
  }
  
  get buffer(){
    let len = this.colors.length;
    let size =
      len > 128 ? 256 :
      len > 64 ? 128 :
      len > 32 ? 64 :
      len > 16 ? 32 :
      len > 8 ? 16 :
      len > 4 ? 8 :
      len > 2 ? 4 :
      2
    ;
    let view = new Uint8Array( size * 3 );
    let rgbArr = this.colors.map( (c) => c.slice(1).match(/../g).map((s)=>parseInt(s,16)) );
    let palArr = rgbArr.flat();
    for( let i=0; i<palArr.length; i++ ){
      view[i] = palArr[i]
    }
    return view.buffer;
  }
  
  /**
   * returns transferable copy for sending to a worker
   */
  toTransferable(){
    let { colors, hasAlpha, alphaIdx } = this;
    return {
      colors, hasAlpha, alphaIdx
    };
  }
  
  /**
   * to be used, inside of a worker, to reconstruct
   * an instance
   */
  static fromTransferable( { colors, hasAlpha, alphaIdx } ){
    let pal = new GifPalette();
    for( let color of colors ){
      pal.addColor( color );
    }
    if( hasAlpha ){
      pal.alphaIdx = alphaIdx;
    }
    return pal;
  }

  clone(){
    return GifPalette.fromTransferable( this.toTransferable() );
  }
  
}