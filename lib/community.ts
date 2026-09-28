export type Membership = { user_id: string; display_name: string; status: 'pending' | 'approved' | 'rejected' | 'suspended'; requested_at: string };
export type Story = { id: string; user_id: string; author_name: string; caption: string; image_path: string; expires_at: string; created_at: string; status: string };
export type Challenge = { id: string; title: string; description: string; target: number; starts_on: string; ends_on: string; active: boolean };
export type Checkin = { challenge_id: string; day: string };
export const BUCKET = 'summer-stories';
export function brazilDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function communityError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e?.code === 'PHOTO_VALIDATION') return e.message || 'Escolha outra foto.';
  if (e?.code === '23505') return 'Você já enviou esta solicitação, participação ou check-in. Atualize para conferir.';
  if (e?.code === '42501') return 'Acesso não autorizado. Confira se sua participação foi aprovada.';
  if (e?.message?.startsWith('Limite de 5')) return e.message;
  return 'Não foi possível concluir. Confira a conexão e tente novamente. Se persistir, avise o administrador.';
}

// Re-encode in the browser: strip EXIF/location metadata and limit dimensions and size.
export async function prepareStoryPhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024)
    throw new Error('Escolha uma foto JPG, PNG ou WebP de até 15 MB. No iPhone, use uma captura de tela se a foto estiver em HEIC.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Não conseguimos abrir a foto. Escolha outra.')); img.src = url; });
    const scale = Math.min(1, 1440 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador não conseguiu preparar a imagem.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('Foto muito grande. Tente outra imagem.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
