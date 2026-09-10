// One geometry for drawing, trading, computer moves, and business income.
export const BOARD_REVISION=2;
export const CELL_PITCH=52;
export const CELL_SIZE=50;
export const BLOCK_LAYOUTS=[
  {x:92,y:100,rows:[[1,2,3],[0,1,2,3],[0,1,2],[0,1]]},
  {x:399,y:105,rows:[[0,1],[0,1,2],[0,1,2,3],[1,2,3]]},
  {x:747,y:120,rows:[[0,1,2],[0,1,2],[0,1,2,3],[2,3]]},
  {x:156,y:439,rows:[[1,2],[1,2,3],[0,1,2],[0,1,2,3]]},
  {x:464,y:404,rows:[[0,1,2,3],[0,1,2],[0,1],[0,1,2]]},
  {x:796,y:451,rows:[[1,2,3],[0,1,2,3],[0,1],[0,1,2]]}
];
export const PLOT_LAYOUT=BLOCK_LAYOUTS.flatMap((block,b)=>{
  let index=0;
  return block.rows.flatMap((columns,row)=>columns.map(col=>({
    id:b*12+index++,block:b,col,row,
    x:block.x+col*CELL_PITCH,y:block.y+row*CELL_PITCH
  })));
});
const edges=PLOT_LAYOUT.map(p=>PLOT_LAYOUT.filter(q=>q.block===p.block&&Math.abs(q.col-p.col)+Math.abs(q.row-p.row)===1).map(q=>q.id));
export function plotNeighbors(id){return edges[id]?[...edges[id]]:[];}
