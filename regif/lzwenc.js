
"use strict";

/**
 * will return a single array buffer
 *
 * https://github.com/jnordberg/gif.js/blob/master/src/LZWEncoder.js
 *
 * LZWEncoder.js ( EDITED/CLEANED UP BY ME IN 2025 )
 *
 */
function lzwEncode( width, height, pixels, initCodeSize ){

  var packets = [];

  var
    EOF = -1,
    BITS = 12,
    HSIZE = 5003, /* 80% occupancy */
    MASKS = [
      0x0000, 0x0001,
      0x0003, 0x0007, 0x000f, 0x001f,
      0x003f, 0x007f, 0x00ff, 0x01ff,
      0x03ff, 0x07ff, 0x0fff, 0x1fff,
      0x3fff, 0x7fff, 0xffff
    ]
  ;

  var curPixel;
  var remaining;
  var nBits;

  initCodeSize = Math.max( 2, initCodeSize );
  var accum, hTab, codeTab;

  accum = new Uint8Array( 256 );
  hTab = new Int32Array( HSIZE );
  codeTab = new Int32Array( HSIZE );

  var
    curAccum = 0,
    curBits = 0,
    aCount,
    freeEnt = 0, /* first unused entry */
    maxCode
  ;

  /**
   * block compression parameters -- after all codes are used up,
   * and compression rate changes, start over.
   */
  var clearFlg = false;

  /**
   * Algorithm: use open addressing double hashing (no chaining) on the
   * prefix code / next character combination. We do a variant of Knuth's
   * algorithm D (vol. 3, sec. 6.4) along with G. Knott's relatively-prime
   * secondary probe. Here, the modular division first probe is gives way
   * to a faster exclusive-or manipulation. Also do block compression with
   * an adaptive reset, whereby the code table is cleared when the compression
   * ratio decreases, but after the table fills. The variable-length output
   * codes are re-sized at this point, and a special CLEAR code is generated
   * for the decompressor. Late addition: construct the table according to
   * file size for noticeable speed improvement on small files. Please direct
   * questions about this implementation to ames!jaw.
   */
  var gInitBits, clearCode, eofCode;

  /**
   * Reset code table
   */
  function clHash( hsize ){
    var i;
    for( i=0; i<hsize; ++i ){
      hTab[i] = -1;
    }
  }

  /**
   * Flush the packet to disk, and reset the accumulator
   */
  function flushChar(){
    if( aCount > 0 ){

      var chunk = accum.slice( 0, aCount);
      var temp;

      temp = new Uint8Array( chunk.length + 1 );
      temp[ 0 ] = aCount;
      temp.set( chunk, 1 );
      chunk = temp;

      packets.push( chunk );

      aCount = 0;
    }
  }

  function _maxCode( nBits ){
    return ( ( 1 << nBits ) - 1 );
  }

  /**
   * Add a character to the end of the current packet, and if it is 254
   * characters, flush the packet to disk.
   */
  function charOut( c ){
    accum[aCount++] = c;
    if( aCount >= 254 ){
      flushChar();
    }
  }

  /**
   * Clear out the hash table
   * table clear for block compress
   */
  function clBlock(){
    clHash( HSIZE );
    freeEnt = clearCode + 2;
    clearFlg = true;
    output( clearCode );
  }

  /**
   * Return the next pixel from the image
   */
  function nextPixel(){
    if( remaining === 0 ){
      return EOF;
    }
    --remaining;
    var pix = pixels[ curPixel++ ];
    return ( pix & 0xff );
  }

  function output( code ){

    curAccum &= MASKS[ curBits ];

    if ( curBits > 0 ){
      curAccum |= ( code << curBits );
    }else{
      curAccum = code;
    }

    curBits += nBits;

    while( curBits >= 8 ){
      charOut( ( curAccum & 0xff ) );
      curAccum >>= 8;
      curBits -= 8;
    }

    /**
     * If the next entry is going to be too big for the code size,
     * then increase it, if possible.
     */
    if( freeEnt > maxCode || clearFlg ){
      if( clearFlg ){
        maxCode = _maxCode( nBits = gInitBits );
        clearFlg = false;
      }else{
        ++nBits;
        if( nBits == BITS){
          maxCode = 1 << BITS;
        }else{
          maxCode = _maxCode( nBits );
        }
      }
    }

    if( code === eofCode ){
      /**
       * At EOF, write the rest of the buffer.
       */
      while( curBits > 0 ){
        charOut( (curAccum & 0xff) );
        curAccum >>= 8;
        curBits -= 8;
      }
      flushChar();
    }

  }

  function compress( initBits ){

    var
      fCode,
      c,
      i,
      ent,
      disp,
      hSizeReg,
      hShift
    ;

    /* Set up the globals: g_init_bits - initial number of bits */
    gInitBits = initBits;

    /* Set up the necessary values */
    clearFlg = false;
    nBits = gInitBits;
    maxCode = _maxCode( nBits );

    clearCode = 1 << ( initBits - 1 );
    eofCode = clearCode + 1;
    freeEnt = clearCode + 2;

    aCount = 0;                   /* clear packet */

    ent = nextPixel();

    hShift = 0;
    for( fCode=HSIZE; fCode<65536; fCode*=2 ){
      ++hShift;
    }

    hShift = 8 - hShift;          /* set hash code range bound */
    hSizeReg = HSIZE;

    clHash( hSizeReg );           /* clear hash table */

    output( clearCode );

    outer_loop: while( (c=nextPixel() ) != EOF ){

      fCode = ( c << BITS ) + ent;
      i = ( c << hShift ) ^ ent;  /* xor hashing */
      if( hTab[i] === fCode ){
        ent = codeTab[i];
        continue;
      }else if( hTab[i] >= 0 ){   /* non-empty slot */
        disp = hSizeReg - i;      /* secondary hash (after G. Knott) */
        if( i === 0 ){
          disp = 1;
        }
        do{
          if( (i -= disp) < 0 ){
            i += hSizeReg;
          }
          if( hTab[i] === fCode ){
            ent = codeTab[i];
            continue outer_loop;
          }
        }while( hTab[i] >= 0 );
      }

      output( ent );

      ent = c;
      if( freeEnt < 1 << BITS ){
        codeTab[i] = freeEnt++;   /* code -> hashtable */
        hTab[i] = fCode;
      }else{
        clBlock();
      }
    }

    /* Put out the final code. */
    output( ent );
    output( eofCode );

  }

  packets.push( new Uint8Array([initCodeSize]) );
  remaining = width * height;
  curPixel = 0;
  compress(initCodeSize + 1);
  packets.push( new Uint8Array([0]) );

  var superUi8 = function(){

    var size = 0;
    var i, ui8;
    for( i=0; i<packets.length; i++ ){
      ui8 = packets[i];
      size += ui8.length;
    }

    var superUi8 = new Uint8Array( size );

    var offs=0, j;
    for( i=0; i<packets.length; i++ ){
      ui8 = packets[i];
      for( j=0; j<ui8.length; j++ ){
        superUi8[ offs + j ] = ui8[ j ];
      }
      offs += ui8.length;
    }

    return superUi8;

  }();

  return superUi8.buffer;

}