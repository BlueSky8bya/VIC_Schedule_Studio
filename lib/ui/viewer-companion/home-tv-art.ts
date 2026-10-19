/** Asset-space CRT plane for the136 left-facing, thick illustrated cabinet.
 * Only the changing picture is projected; the entire body remains intact. */
export const COMPANION_TV_ART_VIEWBOX = "0 0 512 512";
// The picture overfills the original glass, then clips to its actual inner
// contour. This keeps its curved lower edge filled without painting the bezel.
// Points were sampled one native pixel inside the connected neutral CRT area
// of the unchanged512px body; no raster/body/physics anchor is modified.
export const COMPANION_TV_SCREEN_CLIP = "M133 167L177 172L227 183L242 188L254 200L254 203L257 209L259 222L260 253L261 254L259 321L258 322L256 344L253 354L251 358L246 363L239 366L216 366L168 359L118 347L88 337L80 333L73 326L68 313L66 301L65 273L64 272L64 232L65 231L66 205L70 183L76 170L82 166Z";
export const COMPANION_TV_SCREEN_TRANSFORM = "matrix3d(2.0503054436,0.2997234932,0,-0.000110800584,-0.0072129201,1.9462500927,0,0.000047238642,0,0,1,0,60,151,0,1)";
