import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get('size'));
  const size = [180,192,512].includes(requested) ? requested : 512;
  const photo = await readFile(path.join(process.cwd(),'public/summer-fit-mascot.jpeg'));
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#fff',border:`${size*.025}px solid #bc101b`,borderRadius:size*.15}}>
      <img src={`data:image/jpeg;base64,${photo.toString('base64')}`} alt="" width={size*.80} height={size*.70} style={{objectFit:'contain'}} />
      <div style={{display:'flex',background:'#ffd600',color:'#171717',fontSize:size*.11,fontWeight:700,padding:`0 ${size*.04}px`,borderRadius:size*.02}}>SUMMER FIT</div>
    </div>,
    {width:size,height:size,headers:{'Cache-Control':'public, max-age=86400'}}
  );
}
