
/**
 * @todo - does this actually do anything or is it just
 * magical thinking?
 */
// function disposeArrayBuffers( buffs ){
//   if( buffs instanceof Array === false ){
//     throw new Error("buffs was not an Array");
//   }
//   var i, buff;
//   for( i=0; i<buffs.length; i++ ){
//     buff = buffs[i];
//     if( buff instanceof ArrayBuffer === false ){
//       console.warn("item at index " + i + " was not an ArrayBuffer; ignoring");
//     }else{
//       buff.transfer(0);
//     }
//   }
// }

function isAllZeros( view ){
  if( view instanceof Object.getPrototypeOf(Uint8Array) === false ){
    throw new Error("view was not a TypedArray");
  }
  var i;
  for( i=0; i<view.length; i++ ){
    if( view[i] !== 0 ){
      return false;
    }
  }
  return true;
}

function makeCtx2d( width, height, opts ){
  var canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext("2d", opts);
  return ctx;
}

function ctx2rgbaBuff(ctx){
  if( ctx instanceof CanvasRenderingContext2D === false ){
    throw new Error("ctx was not a CanvasRenderingContext2D");
  }
  let { canvas } = ctx;
  let { width, height } = canvas;
  let iData = ctx.getImageData( 0,0,width,height );
  return iData.data.buffer;
}

function rgbaBuff2ctx( rgbaBuff, width, height ){
  if( rgbaBuff instanceof ArrayBuffer === false ){
    throw new Error( "rgbaBuff was not an ArrayBuffer" );
  }
  let view32 = new Uint32Array( rgbaBuff );
  let iData = new ImageData( new Uint8ClampedArray( rgbaBuff ), width, height );
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");
  ctx.putImageData( iData, 0, 0 );
  return ctx;
}

function canvas2rgbaBuff(canvas){
  if( canvas instanceof HTMLCanvasElement === false ){
    throw new Error("canvas was not a HTMLCanvasElement");
  }
  let { width, height } = canvas;
  let canvas2 = document.createElement("canvas");
  canvas2.width = width;
  canvas2.height = height;
  let ctx2 = canvas2.getContext("2d");
  ctx2.drawImage( canvas, 0,0,width,height );
  let rgbaBuff = ctx2rgbaBuff( ctx2 );
  /* dispose canvas */
  canvas2.width = 0;
  canvas2.height = 0;
  return rgbaBuff;
}

function img2ctx( img ){
  let width, height;
  if( img instanceof Image ){
    width = img.naturalWidth;
    height = img.naturalHeight;
  }else if( img instanceof ImageBitmap ){
    width = img.width;
    height = img.height;
  }else{
    throw new Error("only supports Image or ImageBitmap")
  }
  if( !width || !height ){
    throw new Error("cannot have 0 width or height");
  }
  let ctx = makeCtx2d( width, height );
  ctx.drawImage( img, 0, 0, width, height );
  return ctx;
}

function hashUi8( ui8 ){
  
  if( ui8 instanceof Uint8Array === false ){
    throw new Error("ui8 was not a Uint8Array");
  }

  if( ui8.length === 0 ){
    return 0;
  }

  var hash=0, i, ch;
  for( i=0; i<ui8.length; i++ ){
    ch = ui8[i];
    hash = ((hash << 5) - hash) + ch;
    hash |= 0; /* convert to 32 bit int */
  }

  /* remove the sign */
  return hash >>> 0;

}

function hashCtx( ctx ){
  if( ctx instanceof CanvasRenderingContext2D === false ){
    throw new Error("ctx was not a CanvasRenderingContext2D");
  }
  let rgbaBuff = ctx2rgbaBuff( ctx );
  let view = new Uint8Array( rgbaBuff );
  let result = hashUi8( view );
  rgbaBuff.transfer?.(0);
  return result;
}

async function imgBlob2rgbaBuff(blob){
  if( blob instanceof Blob === false ){
    throw new Error("blob was not a Blob");
  }
  let bm = await createImageBitmap( blob );
  let ctx = document.createElement("canvas").getContext("2d");
  let { canvas } = ctx;
  let { width, height } = bm;
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage( bm, 0, 0, width, height );
  let rgbaBuff = ctx2rgbaBuff( ctx );
  /* dispose canvas */
  canvas.width = 0;
  canvas.height = 0;
  return [
    rgbaBuff,
    width,
    height,
  ];
}

function compareLengthyObjs( a, b ){
  if( a.length !== b.length ){
    return false;
  }
  for( let i=0; i<a.length; i++ ){
    if( (i in a) && (i in b === false) ){
      return false;
    }
    if( (i in a === false) && (i in b) ){
      return false;
    }
    if( a[i] !== b[i] ){
      return false;
    }
  }
  return true;
}