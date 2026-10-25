// Web Worker: builds terrain chunks off the main thread so the frame rate holds while Tal's ground
// refines. Messages in: {id, face, level, ix, iy}. Out: the chunk from buildChunk() plus its id.
import {buildChunk} from './terrain-build.js';

self.onmessage = e => {
  const {id, face, level, ix, iy} = e.data, c = buildChunk(face, level, ix, iy);
  self.postMessage({id, ...c}, [c.pos.buffer, c.nor.buffer]);
};
