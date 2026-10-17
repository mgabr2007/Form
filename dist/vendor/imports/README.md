# Import dependencies

All runtime dependencies are served locally; importing a model does not request a CDN or upload its geometry.

| Files | Version / upstream | Licence |
| --- | --- | --- |
| GLTFLoader.js, BufferGeometryUtils.js | Three.js 0.180.0, https://github.com/mrdoob/three/tree/r180 | MIT; ../LICENSE.txt |
| fflate.js | fflate 0.8.2, https://github.com/101arrowz/fflate/tree/v0.8.2 | MIT; fflate-LICENSE.txt |
| web-ifc-api.js, web-ifc.wasm | web-ifc 0.0.75, npm gitHead ac5de14d320dde70515ce1619e48cfb6a5eaf51b | MPL-2.0; web-ifc-LICENSE.txt |

web-ifc source, corresponding to the distributed package: https://github.com/ThatOpen/engine_web-ifc/tree/ac5de14d320dde70515ce1619e48cfb6a5eaf51b . Source/build instructions and notices are maintained there. The API and WASM files are copied unchanged from the npm package. The single-thread WASM path is used; no SharedArrayBuffer/cross-origin-isolation requirement is introduced.

Reproduction: install `three@0.180.0 web-ifc@0.0.75 fflate@0.8.2` into a temporary directory. Copy Three's `examples/jsm/loaders/GLTFLoader.js` and `examples/jsm/utils/BufferGeometryUtils.js`, changing bare `three` imports to `../three.module.js` and the utility import to `./BufferGeometryUtils.js`. Copy fflate's `esm/browser.js` as `fflate.js`. Copy web-ifc's browser `web-ifc-api.js` and `web-ifc.wasm`. Retain upstream licence files. The bundled dependency source files, not a network-selected latest release, determine runtime behavior.
