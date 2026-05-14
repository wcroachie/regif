"use strict";

class GifAlphaMap{
  
  /**
   * yes, it needs to be a view because
   * at() will call numerous times repeatedly
   * and it doesn't make sense to create a
   * view every time.
   *
   * the 1-bit alpha channel is stored in
   * the view, with padding to the next highest
   * byte. the true size (of the channel, 1 pixel
   * per channel) is width * height
   */
  #view = null;
  #width = 0;
  #height = 0;
  
  get buffer(){
    return this.#view.buffer.slice();
  }
  
  get width(){
    return this.#width;
  }
  
  get height(){
    return this.#height;
  }
  
  /**
   * determine whether provided pixel
   * index is transparent or not
   */
  at( pxIdx ){
    let bitOffs = pxIdx % 8;
    let byteOffs = (pxIdx - bitOffs) / 8;
    let byte = this.#view[ byteOffs ];
    let bit = !!(byte & ( 1 << bitOffs ));
    return bit;
  }
  
  /* set a pixel */
  unset( pxIdx ){
    
    let bitOffs = pxIdx % 8;
    let byteOffs = (pxIdx - bitOffs) / 8;
    let byte = this.#view[ byteOffs ];
    
    /* create a mask, unset the bit and update the byte */
    let mask = 1 << bitOffs;
    byte = byte & ~mask;
    this.#view[ byteOffs ] = byte 
    
  }
  
  /* unset a pixel */
  set( pxIdx ){
    
    let bitOffs = pxIdx % 8;
    let byteOffs = (pxIdx - bitOffs) / 8;
    let byte = this.#view[ byteOffs ];
    
    /* create a mask, set the bit and update the byte */
    let mask = 1 << bitOffs;
    byte = byte | mask;
    this.#view[ byteOffs ] = byte;
    
  }
  
  /* clean up the mask */
  clean( iterations ){
    
    iterations = iterations >>> 0;
    iterations = Math.max( 1, iterations );
    iterations = Math.min( 8, iterations );
    
    let { width, height } = this;
    
    for( let i=0; i<iterations; i++ ){
      
      let y, x, pxC, pxN, pxS, pxE, pxW;
      
      for( y=0; y<height; y++ ){
        for( x=0; x<width; x++ ){
          
          pxC = this.at( (y * width) + x );
          
          pxN = this.at( ((y-1) * width ) + x );
          pxS = this.at( ((y+1) * width ) + x );
          pxW = this.at( (y * width) + (x-1) );
          pxE = this.at( (y * width) + (x+1) );
          
          if( !pxN && !pxS ){
            this.unset( (y * width) + x );
          }
          
          if( !pxW && !pxE ){
            this.unset( (y * width) + x );
          }
          
        }
      }
    }
  }
  
  /**
   * FOR INDEXED PIXELS
   * 
   * go through provided indices and
   * see if the pixel is marked as
   * transparent. if it is, set it to
   * the alpha index provided as the
   * second argument
   */
  apply( indicesBuff, alphaIdx ){
    if( indicesBuff instanceof ArrayBuffer === false ){
      throw new Error("indicesBuff was not an ArrayBuffer");
    }
    alphaIdx = alphaIdx & 0xff;
    let view = new Uint8Array( indicesBuff );
    for( let i=0; i<view.length; i++ ){
      if( !this.at( i ) ){
        view[i] = alphaIdx;
      }
    }
  }
  
  constructor( rgbaBuff, width, height, threshold ){
    
    this.#width = width;
    this.#height = height;
    
    /* this channel will be 1/4 the size */
    let chanBuff = rgba2chan( rgbaBuff, 3 );
    let maskBuff = chan2mask( chanBuff, threshold );
    
    this.#view = new Uint8Array( maskBuff );
    
  }
  
  /**
   * returns transferable copy for sending to a worker
   */
  toTransferable(){
    let buffer = this.#view.buffer.slice();
    let { width, height } = this;
    return { buffer, width, height };
  }
  
  /**
   * to be used, inside of a worker, to reconstruct
   * an instance from provided mask, width, and height
   */
  static fromTransferable( { buffer, width, height } ){
    
    if( buffer instanceof ArrayBuffer === false ){
      throw new Error("buffer was not an ArrayBuffer");
    }
    
    width = width >>> 0;
    height = height >>> 0;
    
    let size = width * height;
    let chanBuff = mask2chan( buffer, size );
    let rgbaBuff = chan2rgba( chanBuff, 3 );
    
    return new AlphaMap( rgbaBuff, width, height, 1 );
    
  }
  
}
