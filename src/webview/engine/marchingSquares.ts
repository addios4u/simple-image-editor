/**
 * Marching Squares contour extraction for binary masks.
 *
 * Given a Uint8Array mask (0 = off, non-zero = on) and its dimensions,
 * returns an array of closed contour polylines — each as an array of [x, y]
 * coordinate pairs. Multiple disjoint regions produce separate contours.
 *
 * The algorithm pads the mask by 1 pixel on each side (virtual zeros) so
 * that shapes touching the mask edge still produce closed contours.
 */

type Point = [number, number];

/**
 * Sample the mask at (x, y), treating out-of-bounds as 0.
 * Returns 1 if the pixel is selected, 0 otherwise.
 */
function sample(mask: Uint8Array, w: number, h: number, x: number, y: number): number {
  if (x < 0 || x >= w || y < 0 || y >= h) return 0;
  return mask[y * w + x] !== 0 ? 1 : 0;
}

/**
 * Extract closed contour polylines from a binary mask using Marching Squares.
 *
 * @param mask  Uint8Array of length `width * height`, non-zero = selected
 * @param width  Mask width in pixels
 * @param height Mask height in pixels
 * @returns Array of contours. Each contour is an array of [x, y] points
 *          forming a closed loop (first point === last point).
 */
export function extractContour(
  mask: Uint8Array,
  width: number,
  height: number,
): Point[][] {
  // We iterate over a grid that is (width+1) x (height+1) cells.
  // Each cell (cx, cy) examines the 2x2 block of mask pixels:
  //   top-left:     (cx-1, cy-1)
  //   top-right:    (cx,   cy-1)
  //   bottom-left:  (cx-1, cy  )
  //   bottom-right: (cx,   cy  )

  const cols = width + 1;
  const rows = height + 1;

  // Track which cell edges have been visited to avoid duplicating contours.
  // We store visited state per cell per entry direction.
  // Key: `${cx},${cy},${direction}`
  const visited = new Set<string>();

  const contours: Point[][] = [];

  // Direction vectors for tracing: 0=right, 1=down, 2=left, 3=up
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const caseIndex = cellCase(mask, width, height, cx, cy);
      // Only start tracing from cells that have exactly one edge segment
      // entering from the left or top, to avoid double-tracing.
      if (caseIndex === 0 || caseIndex === 15) continue;

      // Try to start a contour from this cell
      const startKey = `${cx},${cy}`;
      if (visited.has(startKey)) continue;

      const contour = traceContour(mask, width, height, cols, rows, cx, cy, visited);
      if (contour && contour.length >= 3) {
        // Close the contour
        contour.push(contour[0]);
        contours.push(contour);
      }
    }
  }

  return contours;
}

/**
 * Compute the marching squares case index (0-15) for cell (cx, cy).
 */
function cellCase(
  mask: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
): number {
  const tl = sample(mask, w, h, cx - 1, cy - 1);
  const tr = sample(mask, w, h, cx, cy - 1);
  const bl = sample(mask, w, h, cx - 1, cy);
  const br = sample(mask, w, h, cx, cy);
  return (tl << 3) | (tr << 2) | (br << 1) | bl;
}

/**
 * Compute the edge midpoint(s) for a given case.
 * Returns the exit direction and the interpolated point on the edge.
 *
 * Edge layout for cell (cx, cy):
 *   Top edge:    between (cx, cy) and (cx+1, cy)   — midpoint at (cx+0.5, cy)
 *   Right edge:  between (cx+1, cy) and (cx+1, cy+1) — midpoint at (cx+1, cy+0.5)
 *   Bottom edge: between (cx, cy+1) and (cx+1, cy+1) — midpoint at (cx+0.5, cy+1)
 *   Left edge:   between (cx, cy) and (cx, cy+1) — midpoint at (cx, cy+0.5)
 *
 * We define edges as: 0=top, 1=right, 2=bottom, 3=left
 */

// For each case, the edges that the contour crosses.
// Each entry is [entryEdge, exitEdge] pairs. For ambiguous cases (5, 10)
// we pick one interpretation (no saddle disambiguation needed for our use).
const EDGE_TABLE: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[2, 3]],
  2: [[1, 2]],
  3: [[1, 3]],
  4: [[0, 1]],
  5: [[0, 1], [2, 3]], // ambiguous — two segments
  6: [[0, 2]],
  7: [[0, 3]],
  8: [[3, 0]],
  9: [[2, 0]],
  10: [[1, 0], [3, 2]], // ambiguous — two segments
  11: [[1, 0]],
  12: [[3, 1]],
  13: [[2, 1]],
  14: [[3, 2]],
  15: [],
};

/**
 * Get the midpoint coordinate on a given edge of cell (cx, cy).
 */
function edgeMidpoint(cx: number, cy: number, edge: number): Point {
  switch (edge) {
    case 0: return [cx + 0.5, cy];       // top
    case 1: return [cx + 1, cy + 0.5];   // right
    case 2: return [cx + 0.5, cy + 1];   // bottom
    case 3: return [cx, cy + 0.5];       // left
    default: return [cx, cy];
  }
}

/**
 * Given we exit cell (cx, cy) through `exitEdge`, return the neighboring
 * cell coordinates and the entry edge in that neighbor.
 */
function neighborCell(
  cx: number,
  cy: number,
  exitEdge: number,
): { nx: number; ny: number; entryEdge: number } {
  // Exiting through top → enter neighbor above through bottom
  // Exiting through right → enter neighbor right through left
  // Exiting through bottom → enter neighbor below through top
  // Exiting through left → enter neighbor left through right
  const oppositeEdge = (exitEdge + 2) % 4;
  const dxMap = [0, 1, 0, -1];
  const dyMap = [-1, 0, 1, 0];
  return {
    nx: cx + dxMap[exitEdge],
    ny: cy + dyMap[exitEdge],
    entryEdge: oppositeEdge,
  };
}

/**
 * Trace a single closed contour starting from cell (startCx, startCy).
 */
function traceContour(
  mask: Uint8Array,
  w: number,
  h: number,
  cols: number,
  rows: number,
  startCx: number,
  startCy: number,
  visited: Set<string>,
): Point[] | null {
  const points: Point[] = [];

  let cx = startCx;
  let cy = startCy;
  let entryEdge = -1; // first cell: pick any valid segment

  const maxSteps = (cols + rows) * 4; // safety limit
  let steps = 0;

  while (steps < maxSteps) {
    steps++;

    const caseIdx = cellCase(mask, w, h, cx, cy);
    if (caseIdx === 0 || caseIdx === 15) break;

    const segments = EDGE_TABLE[caseIdx];
    if (!segments || segments.length === 0) break;

    // Find a segment that matches our entry edge (or pick the first if starting)
    let exitEdge = -1;
    let usedEntry = -1;

    if (entryEdge === -1) {
      // Starting: use the first segment
      usedEntry = segments[0][0];
      exitEdge = segments[0][1];
    } else {
      for (const [ein, eout] of segments) {
        if (ein === entryEdge) {
          usedEntry = ein;
          exitEdge = eout;
          break;
        }
      }
    }

    if (exitEdge === -1) break;

    const key = `${cx},${cy}`;
    visited.add(key);

    // Add the midpoint of the exit edge
    points.push(edgeMidpoint(cx, cy, exitEdge));

    // Move to the neighbor
    const { nx, ny, entryEdge: nextEntry } = neighborCell(cx, cy, exitEdge);

    // Check if we've returned to start
    if (nx === startCx && ny === startCy && points.length > 1) {
      break;
    }

    // Check bounds
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) break;

    cx = nx;
    cy = ny;
    entryEdge = nextEntry;
  }

  return points.length >= 3 ? points : null;
}
