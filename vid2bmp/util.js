"use strict";





function createHelperVideo( displayVideo ){

  displayVideo = !!displayVideo;

  let video = document.createElement("video");

  video.style.position = "fixed";
  video.style.display = "block";
  video.style.left = "50%";
  video.style.top = "50%";
  video.style.transform = "translate( -50%, -50% )"
  video.style.width = "320px";
  video.style.height = "240px";
  video.style.maxWidth = "100%";
  video.style.maxHeight = "100%";
  video.style.objectFit = "contain";
  video.style.border = "1px solid cornflowerblue";
  video.style.boxSizing = "border-box";
  video.style.backgroundColor = "black";
  video.style.opacity = 0.2;
  video.style.pointerEvents = "none";
  video.style.touchAction = "none";
  
  video.setAttribute( "playsinline", "" );
  video.setAttribute( "webkit-playsinline", "" );
  video.setAttribute( "muted", "" );
  video.setAttribute( "controls", "" );
  
  if( !displayVideo ){
    video.style.opacity = 0;
  }
  
  /* both also need to be set to true for chromium or else video wont play */
  video.playsInline = true;
  video.muted = true;
  video.controls = true;

  /**
   * need to set these to true for firefox, if loop is not set, it will
   * not load the last few frames
   */
  video.setAttribute( "autoplay", "" );
  video.autoplay = true;
  video.setAttribute( "loop", "" );
  video.loop = true;

  return video;

}








/**
 * @note - using requestVideoFrameCallback is
 * super buggy and stops working when you minimize
 * the window or focus away in some browsers.
 * this method does not rely on playing/pausing
 * the media and uses updating the video's
 * currentTime property along with a seeked event
 * listener to incremement through the video.
 * it then draws a thumbnail of the video to a 
 * small canvas, hashes the pixel data, and checks
 * to see if it is different from the frame before
 * it. when the hash is different it resolves.
 */
async function seekToNextUniqueFrame( video, accuracyFps ){

  if( video instanceof HTMLVideoElement === false ){
    throw new Error("video was not a HTMLVideoElement");
  }

  accuracyFps = accuracyFps >>> 0;

  if( video.videoWidth === 0 || video.videoHeight === 0 ){
    throw new Error("video height and width cannot be 0");
  }
  
  if( video.currentTime >= video.duration ){
    throw new Error("cannot seek forward because video has reached the end of playback");
  }
  if( document.hidden ){
    throw new Error("cannot seek because document is hidden");
  }
  if( video.readyState < video.HAVE_CURRENT_DATA ){
    throw new Error("cannot seek because video's readyState was lower than video.HAVE_CURRENT_DATA");
  }
  if( !video.paused ){
    throw new Error("the video must be paused in order to execute seekToNextUniqueFrame");
  }

  return await async function(){
  
    /**
     * @note - it is important to set willReadFrequently
     * to true here, as not doing that will cause chromium
     * to read way more frames as "unique" when they actually
     * are not
     */
    let miniCtx = makeCtx2d( 0, 0, {willReadFrequently : true} );

    let aspect = video.videoWidth / video.videoHeight;
    let h = 128;
    let w = h * aspect;

    miniCtx.canvas.width = w;
    miniCtx.canvas.height = h;

    const capture = async () => {
      miniCtx.clearRect( 0, 0, w, h );
      miniCtx.drawImage( video, 0, 0, w, h );
      let data = new Uint8Array( ctx2rgbaBuff( miniCtx ) );
      if( isAllZeros( data ) ){
        console.warn( "capture was empty; attempting to un-stick" );
        await video.play();
        video.pause();
        if( video.currentTime >= video.duration ){
          throw new Error("the video reached the end of playback before the next unique frame could be found");
        }
        return await capture();
      }
      return data;
    };

    const incrementForward = async () => await new Promise( (res,rej) => {
      video.addEventListener( "seeked", () => {
        if( video.currentTime >= video.duration ){
          rej( new Error("the video reached the end of playback before the next unique frame could be found") );
        }else{
          res();
        }
      }, {once:true} );
      video.currentTime += 1/accuracyFps;
    } );
    
    let prevFrameData, currFrameData;

    prevFrameData = await capture();
    await incrementForward();
    currFrameData = await capture();

    while( compareLengthyObjs( prevFrameData, currFrameData ) ){
      await incrementForward();
      currFrameData = await capture();
    }

    prevFrameData.buffer.transfer?.();
    currFrameData.buffer.transfer?.();
    
    return [ performance.now(), {
      expectedDisplayTime : null,
      height : null,
      mediaTime : video.currentTime,
      presentationTime : null,
      presentedFrames : null,
      processingDuration : null,
      width : null
    } ];
  
  }();

}







/**
 * the following function scans a video file for
 * keyframes via an HTML video element, and then
 * every time a unique keyframe is detected, it
 * can execute a (optionally async) callback.
 */
async function scanVideoForKeyframes( videoBlob, scanFps, onprogress, onkeyframe, displayVideo ){
  return await new Promise( (res,rej) => {
  
    if( videoBlob instanceof Blob === false ){
      throw new Error("videoBlob was not a Blob");
    }

    scanFps = scanFps >>> 0;
    displayVideo = !!displayVideo;
    onprogress = onprogress || (() => {});
    onkeyframe = onkeyframe || (() => {});

    if( typeof onprogress !== "function" ){
      throw new Error("if truthy, onprogress must be a function")
    }
    if( typeof onkeyframe !== "function" ){
      throw new Error("if truthy, onkeyframe must be a function")
    }

    /*******************************************/

    const getPercentageReadout = ( loaded, total ) => {
      let prog = loaded/total;
      prog = (~~(prog * 10000))/100;
      return prog + "%";
    };

    let video = createHelperVideo( displayVideo );
    
    document.documentElement.appendChild( video );

    const dispose = () => {
      URL.revokeObjectURL( video.src );
      video.remove();
    };

    let errored = false;
    let error = null;

    video.addEventListener( "error", (e) => {
      errored = true;
      error = video.error;
    } );

    video.addEventListener( "loadedmetadata", async () => {

      /**
       * pause the video, set current time to 0,
       * and sleep for 2 seconds. this will ensure
       * that the video will be "synced" regardless
       * of external factors such as browser/device
       * performance, etc
       */
      video.pause();
      video.currentTime = 0;
      await new Promise( (res) => setTimeout( res, 2000 ) );

      const keyframeTimes = [];

      let seeked = [ , { mediaTime : video.currentTime } ];

      let loaded = 0, total = ~~( video.duration * 1000 );
      
      let progIv = setInterval( () => {
        if( ~~( video.currentTime * 1000 ) !== loaded ){
          loaded = ~~( video.currentTime * 1000 );
          let unit = "html-video-scanned-millisecond";
          let readout = getPercentageReadout( loaded, total );
          onprogress( {loaded, total, readout, unit} );
        }
      } );

      try{

        while( video.currentTime < video.duration ){

          let [ , metadata] = seeked;
          
          let timeInMs = Math.round( metadata.mediaTime * 1000 );

          /**
           * prevent duplicate frames - sometimes this
           * can happen with requestVideoFrameCallback
           * when it executes again after it failed once 
           * due to the window being hidden
           */
          if( !keyframeTimes.includes( timeInMs ) ){

            keyframeTimes.push( timeInMs );

            /* use await in case it is an async function */
            await onkeyframe( {
              video,
              time : timeInMs
            } );
    
          }

          try{

            /**
             * @bugfix - ios - may sometimes autoplay the video
             * so always pause before executing this
             */
            video.pause();

            seeked = await seekToNextUniqueFrame( video, scanFps );

          }catch(e){

            console.warn( e );

            if( document.hidden ){

              await new Promise( (res) => {
                let iv = setInterval( () => {
                  if( !document.hidden ){
                    clearInterval(iv);
                    res();
                  }
                } );
              } );
              await new Promise( (res) => setTimeout( res, 500 ) );
              continue;

            }else if( video.readyState < video.HAVE_CURRENT_DATA ){
              
              await new Promise( (res) => {
                let iv = setInterval( () => {
                  if( video.readyState >= video.HAVE_CURRENT_DATA ){
                    clearInterval(iv);
                    res();
                  }
                } );
              } );
              await new Promise( (res) => setTimeout( res, 500 ) );
              continue;

            }else if( video.currentTime >= video.duration ){

              console.warn("media reached the end of playback, breaking loop");

              break;

            }else{

              throw e;

            }
          }

        }

      }catch(e){

        errored = true;
        error = e;

      }

      clearInterval( progIv );

      dispose();

      if( errored ){
        rej( error );
      }else{
        res();
      }

    } );

    video.src = URL.createObjectURL( videoBlob );
    video.load();

  } );

}


function createVideoBitmapEmitter( videoBlob, scanFps, debugMode ){

  if( videoBlob instanceof Blob === false ){
    throw new Error("videoBlob was not a Blob");
  }

  scanFps = scanFps >>> 0;
  debugMode = !!debugMode;

  /*******************************************/

  let cancelled = false;

  let emitter = {
    onprogress : null,
    ondata : null,
    onfinished : null,
    stop(){
      cancelled = true;
    },
  };

  let lastFrame = null;
  let captureCount = 0;
  let duration = null;

  debugMode && console.log( "scanning frames..." );
  
  scanVideoForKeyframes( videoBlob, 60, prog => {

    typeof emitter.onprogress === "function" && emitter.onprogress( prog );

  }, async ( {video,time} ) => {

    if( cancelled ){
      throw new Error("video bitmap emitter was aborted");
    }

    /**
     * for all of the "awaits" in here in front of the
     * emitter methods - these are here in case the 
     * emitter handler is an async function
     */

    if( duration === null ){
      duration = video.duration;
    }

    let bitmap;

    /**
     * @bugfix - this might not work in chromium if
     * the video isn't ready and it's difficult to
     * check this reliably besides just doing it over
     * and over every 200 ms until it works
     */
    while( !bitmap ){
      try{

        bitmap = await createImageBitmap( video );

        /* test to make sure bitmap is not empty (it shouldn't be!!! but who knows!) */
        let testCtx = img2ctx( bitmap );
        if( hashCtx( testCtx ) === 0 ){
          /* dispose canvas */
          testCtx.canvas.width = 0;
          testCtx.canvas.height = 0;
          throw new Error("bitmap was empty");
        }
        /* dispose canvas */
        testCtx.canvas.width = 0;
        testCtx.canvas.height = 0;

      }catch( e ){
        console.warn( e );
        await new Promise( (res) => setTimeout( res, 200 ) );
      }
    }

    let frame = { bitmap, time };

    if( lastFrame !== null ){
      lastFrame.displayDuration = frame.time - lastFrame.time;
      typeof emitter.ondata === "function" && await emitter.ondata( lastFrame );
    }

    lastFrame = frame;

    debugMode && console.log( "unique frame captured at " + time  + " ms" );

    captureCount++;

  }, debugMode ).then( async () => {

    debugMode && console.log( "frame scan complete; " + captureCount + " unique frames captured.");

    lastFrame.displayDuration = Math.round(duration * 1000) - lastFrame.time;

    typeof emitter.ondata === "function" && await emitter.ondata( lastFrame );

    await new Promise( (res) => setTimeout(res) );
    
    typeof emitter.onfinished === "function" && await emitter.onfinished();

  } ).catch( (err) => {
    console.error( err );
  } );

  return emitter;

};