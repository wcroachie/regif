void function(){
  
  
  
  
  
  
  
  
  const inp = document.querySelector("input");
  
  inp.oninput = async () => {

    let {
        Gif87a,
        Gif89a,
      } = ReGif;

    let [ file ] = inp.files;
    
    if( file.type.startsWith("video/") ){

      let width, height, started = false, gif;
      let datas = [];

      let em = createVideoBitmapEmitter( file, 1000, true );
      em.onprogress = console.log;
      em.ondata = async ({ bitmap, time, displayDuration }) => {
        
        if( !started ){
          width = bitmap.width;
          height = bitmap.height;
          gif = new Gif89a({ width, height });
          gif.ondata = (data) => datas.push( data );
          started = true;
        }

        let ctx = img2ctx( bitmap );
        let rgbaBuff = canvas2rgbaBuff( ctx.canvas );
        let rgbBuff = rgba2rgb( rgbaBuff );

        let palette = await quantizeAsync( rgbBuff );
        let indicesBuff = await rgb2indexedAsync( rgbBuff, palette, {
          // dither : "floyd-steinberg",
          // width,
          // height,
          // serpentine : true,
        } );

        gif.writeFrame({
          indicesBuff,
          palette,
          displayDuration
        });

        console.log("a frame was written");

      };
      em.onfinished = () => {
        let blob = new Blob( datas, { type : "image/gif" } );
        console.log( blob );
        document.body.appendChild( new Image() ).src = URL.createObjectURL( blob );
      };

    }else{

      let [ rgbaBuff, width, height ] = await imgBlob2rgbaBuff( file );

      let rgbBuff = rgba2rgb( rgbaBuff );
      
      
      /* view pixels before indexing */
      {
        let rgbBuffB = rgbBuff.slice();
        let rgbaBuffB = rgb2rgba( rgbBuffB );
        document.body.appendChild( document.createElement("p") ).textContent = "opaque pixels before indexing:";
        document.body.appendChild( rgbaBuff2ctx( rgbaBuffB, width, height ).canvas );
      }
      
      
      
      
      /* NOTE - numColors cannot be below 4 for quantizing */
      let palette = await quantizeAsync( rgbBuff, {
        quality : 1,
        // numColors : 7,
        numColors : 255
      } );
      // let palette = new GifPalette();
      // palette.addColor( "#000000" );
      // palette.addColor( "#ffffff" );
      
      let alphaColor;
      
      /**
       * define extra color for hex palette (find first color
       * that isn't used to use for alpha)
       *
       * we start at pure blue because it's easy to see/troubleshoot
       * and there are plenty more colors higher than 0x0000ff
       */
      let hexCols = palette.colors;
      for( let i=0x0000ff; i<0xffffff; i++ ){
        let hex = "#" + i.toString(16).padStart(6,"0");
        if( !hexCols.includes( hex ) ){
          alphaColor = hex;
          break;
        }
      }
      
      palette.addColor( alphaColor );
      palette.alphaIdx = palette.colors.indexOf( alphaColor );
      
      let indicesBuff = await rgb2indexedAsync( rgbBuff, palette, {
        dither : "floyd-steinberg",
        width,
        height,
        serpentine : true
      } );
      
      
      
      let alphaMap = new GifAlphaMap( rgbaBuff, width, height, 254 );
      
      alphaMap.clean( 2 );
      
      alphaMap.apply( indicesBuff, palette.alphaIdx );
      
      
      /* view pixels after indexing and, if applicable, 1 bit alpha channel */
      {
        let rgbBuffC = await indexed2rgbAsync( indicesBuff, palette );
        let rgbaBuffC = rgb2rgba( rgbBuffC );
        document.body.appendChild( document.createElement("p") ).textContent = "opaque pixels after indexing:";
        document.body.appendChild( rgbaBuff2ctx( rgbaBuffC, width, height ).canvas );
      }
      
      
      /* create gif image */
      {
        let datas = [];
        
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

        let gif = new Gif89a({
          width,
          height,
          // sorted : false,
          // bgColorIdx : palette.alphaIdx,
          // pxAspRat : 0,
          // colorRes : 0,
          palette,
        });
        
        gif.ondata = (data) => datas.push( data ) ;

        gif.writeFrame({
          left : 0,
          top : 0,
          width,
          height,
          indicesBuff,
          interlaced : false,
          sorted : false,
          // palette,
          hasAlpha : palette.hasAlpha,
          alphaIdx : palette.alphaIdx,
        });

        gif.finish();

        let blob = new Blob( datas, {type:"image/gif"} );
        
        document.body.appendChild( document.createElement("p") ).textContent = "gif image result:";
        let img = document.body.appendChild( new Image() );
        img.src = URL.createObjectURL( blob );
      }
    }
    
  };
  
}()