"use strict";

function concatArrayBuffers( buffs ){
  if( buffs instanceof Array === false ){
    throw new Error("buffs was not an Array");
  }
  var size = 0;
  var i, buff;
  for( i=0; i<buffs.length; i++ ){
    buff = buffs[i];
    if( buff instanceof ArrayBuffer === false ){
      throw new Error("item at index " + i + " was not an ArrayBuffer");
    }
    size += buff.byteLength;
  }
  
  var combined = new Uint8Array( size );
  var offs = 0;
  for( i=0; i<buffs.length; i++ ){
    buff = buffs[i];
    combined.set( new Uint8Array( buff ), offs );
    offs += buff.byteLength;
  }
  return combined.buffer;
}

function rgba2rgb( rgbaBuff ){
  
  if( rgbaBuff instanceof ArrayBuffer === false ){
    throw new Error("rgbaBuff was not an ArrayBuffer");
  }

  if( rgbaBuff.byteLength % 4 ){
    throw new Error("rgbaBuff.bytelength must be divisible by 4");
  }
  
  var rgbaUi8 = new Uint8Array( rgbaBuff );
  var rgbUi8 = new Uint8Array( (rgbaUi8.length / 4) * 3 );
  var i, offs, r, g, b;
  for( i=0, offs=0; i<rgbaUi8.length; i+=4 ){
    r = rgbaUi8[ i ];
    g = rgbaUi8[ i+1 ];
    b = rgbaUi8[ i+2 ];
    rgbUi8[ offs++ ] = r;
    rgbUi8[ offs++ ] = g;
    rgbUi8[ offs++ ] = b;
  }

  return rgbUi8.buffer;

}

function rgb2rgba( rgbBuff ){
  
  if( rgbBuff instanceof ArrayBuffer === false ){
    throw new Error("rgbBuff was not an ArrayBuffer");
  }

  if( rgbBuff.byteLength % 3 ){
    throw new Error("rgbBuff.bytelength must be divisible by 3");
  }

  var rgbUi8 = new Uint8Array( rgbBuff );
  var rgbaUi8 = new Uint8Array( (rgbUi8.length / 3) * 4 );
  var i, offs, r, g, b;
  for( i=0, offs=0; i<rgbaUi8.length; i+=4 ){
    r = rgbUi8[ offs++ ];
    g = rgbUi8[ offs++ ];
    b = rgbUi8[ offs++ ];
    rgbaUi8[ i ] = r;
    rgbaUi8[ i+1 ] = g;
    rgbaUi8[ i+2 ] = b;
    rgbaUi8[ i+3 ] = 0xff;
  }

  return rgbaUi8.buffer;

}

/* extract channel : r,g,b or a (arg passed as 0,1,2 or 3) */
function rgba2chan( rgbaBuff, idx ){

  if( rgbaBuff instanceof ArrayBuffer === false ){
    throw new Error("rgbaBuff was not an ArrayBuffer");
  }

  if( rgbaBuff.byteLength % 4 ){
    throw new Error("rgbaBuff.byteLength was not a multiple of 4");
  }
  
  if( [ 0, 1, 2, 3 ].indexOf( idx ) === -1 ){
    throw new Error("index must be either 0, 1, 2, or 3");
  }

  var rgbaLen = rgbaBuff.byteLength;
  var chanLen = rgbaLen / 4;

  var rgbaView = new Uint8Array( rgbaBuff );
  var chanView = new Uint8Array( chanLen );
  
  var i, j;
  for( i=idx, j=0; i<rgbaLen; i+=4 ){
    chanView[j++] = rgbaView[i];
  }

  return chanView.buffer;

}

/**
 * convert single channel to rgba array with 0s
 * for the other values
 */
function chan2rgba( chanBuff, idx ){

  if( chanBuff instanceof ArrayBuffer === false ){
    throw new Error("chanBuff was not an ArrayBuffer");
  }

  if( [ 0, 1, 2, 3 ].indexOf( idx ) === -1 ){
    throw new Error("index must be either 0, 1, 2, or 3");
  }

  var chanLen = chanBuff.byteLength;
  var rgbaLen = chanLen * 4;

  var chanView = new Uint8Array( chanBuff );
  var rgbaView = new Uint8Array( rgbaLen );

  var i, j;
  for( i=idx, j=0; i<rgbaLen; i+=4 ){
    rgbaView[i] = chanView[j++];
  }

  return rgbaView.buffer;

}

/**
 * convert channel to 1-bit mask.
 * everything ABOVE the threshold will be 1 (opaque),
 * everything BELOW the threshold will be 0 (transparent).
 * @important - if not exact multiple of 8,
 * last byte will have some padding.
 *
 * the size or pixel count will be the number of pixels
 * but the mask itself will be smaller since each pixel
 * can be stored at a single bit
 */
function chan2mask( chanBuff, threshold ){
  
  if( chanBuff instanceof ArrayBuffer === false ){
    throw new Error("chanBuff was not an ArrayBuffer");
  }
  
  threshold = threshold & 0xff;

  /* actual number of pixels */
  var size = chanBuff.byteLength;
  
  /* padding up to nearest byte */
  var padding = !(size % 8) ? 0 : (8 - (size % 8));
  
  /* size needed for buffer to store the alpha bits */
  var maskLen = (size + padding) / 8;
  
  /* create a view for both the channel and the mask */
  var chanView = new Uint8Array( chanBuff );
  var maskView = new Uint8Array( maskLen );

  var i, j;

  if( threshold === 255 ){
    /* essentially completely transparent so just return the empty buffer */
    return maskView.buffer;
  }

  if( threshold === 0 ){
    /* essentially completely opaque so fill with 0xff */
    for( i=0; i<maskLen; i++ ){
      maskView[i] = 255;
    }
    return maskView.buffer;
  }

  var
    b0, b1, b2, b3,
    b4, b5, b6, b7
  ;
  var shift;
  for( i=0, j=0; i<size; ){
    shift = 0;
    b0 = (chanView[i++] > threshold) << shift++;
    b1 = (chanView[i++] > threshold) << shift++;
    b2 = (chanView[i++] > threshold) << shift++;
    b3 = (chanView[i++] > threshold) << shift++;
    b4 = (chanView[i++] > threshold) << shift++;
    b5 = (chanView[i++] > threshold) << shift++;
    b6 = (chanView[i++] > threshold) << shift++;
    b7 = (chanView[i++] > threshold) << shift;
    maskView[ j++ ] = b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7;
  }
  
  return maskView.buffer;

}


function mask2chan( maskBuff, size ){

  if( maskBuff instanceof ArrayBuffer === false ){
    throw new Error("maskBuff was not an ArrayBuffer");
  }
  
  size = size >>> 0;

  var maskLen = maskBuff.byteLength;
  var maskView = new Uint8Array( maskBuff );
  var chanView = new Uint8Array( size );
  var i, j;
  var byte, shift;
  for( i=0, j=0; i<maskLen; i++ ){
    shift = 0;
    byte = maskView[i];
    chanView[j++] = ((byte >> shift++) & 1) * 0xff;
    chanView[j++] = ((byte >> shift++) & 1) * 0xff;
    chanView[j++] = ((byte >> shift++) & 1) * 0xff;
    chanView[j++] = ((byte >> shift++) & 1) * 0xff;
    chanView[j++] = ((byte >> shift++) & 1) * 0xff;
    chanView[j++] = ((byte >> shift++) & 1) * 0xff;
    chanView[j++] = ((byte >> shift++) & 1) * 0xff;
    chanView[j++] = ((byte >> shift++) & 1) * 0xff;
  }

  return chanView.buffer;

}