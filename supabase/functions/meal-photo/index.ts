import { createClient } from 'npm:@supabase/supabase-js@2.91.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BUCKET = 'meal-photos'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif'])
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const response = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

// Student access is capability-based as in the existing student portal: the
// private invite token must match an active invite and approved financial
// access. Never authorize an object by path or client-supplied student ID.
async function access(admin: ReturnType<typeof createClient>, code: string) {
  if (!code || code.length > 256) return null
  const { data: invite, error: inviteError } = await admin.from('student_invites')
    .select('coach_id,student_id,status,expires_at').eq('code', code).eq('status','active')
    .limit(1).maybeSingle()
  if (inviteError || !invite) return null
  if (invite.expires_at && Date.parse(invite.expires_at) <= Date.now()) return null
  const { data: permitted, error: permissionError } =
    await admin.rpc('coachfit_student_financial_access_by_invite', { p_invite_code: code })
  if (permissionError || permitted !== true) return null
  return { coachId: String(invite.coach_id), studentId: String(invite.student_id) }
}
async function record(admin: ReturnType<typeof createClient>, id: string, actor: {coachId:string,studentId:string}) {
  if (!uuid(id)) return null
  const { data, error } = await admin.from('student_meal_logs')
    .select('id,photo_path,photo_mime,photo_size_bytes,coach_id,student_id')
    .eq('id', id).eq('student_id',actor.studentId).eq('coach_id',actor.coachId).maybeSingle()
  if (error || !data) return null
  if (!String(data.photo_path).startsWith(actor.coachId + '/' + actor.studentId + '/')) return null
  return data
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return response({ ok:true })
  if (request.method !== 'POST') return response({ error:'Método não permitido.' },405)
  if (!SUPABASE_URL || !SERVICE_KEY) return response({ error:'Serviço de fotos indisponível.' },503)
  const admin = createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  try {
    const type=request.headers.get('content-type')||''
    if (type.includes('multipart/form-data')) {
      const form=await request.formData()
      const inviteCode=String(form.get('inviteCode')||'').trim()
      const recordId=String(form.get('recordId')||'').trim()
      const file=form.get('file')
      if (!(file instanceof File)) return response({error:'Foto inválida.'},400)
      const mime=String(file.type||'').split(';')[0].trim().toLowerCase()
      if (!ALLOWED.has(mime) || file.size <= 0 || file.size > MAX_BYTES)
        return response({error:'Imagem inválida ou acima de 10 MB.'},413)
      const actor=await access(admin,inviteCode)
      if (!actor) return response({error:'Acesso não autorizado.'},403)
      const meal=await record(admin,recordId,actor)
      if (!meal || mime!==String(meal.photo_mime) || file.size!==Number(meal.photo_size_bytes))
        return response({error:'A foto não corresponde ao registro da refeição.'},403)
      const {error}=await admin.storage.from(BUCKET).upload(meal.photo_path,new Uint8Array(await file.arrayBuffer()),{
        contentType:mime,upsert:false,cacheControl:'3600'
      })
      if (error) return response({error:'Não foi possível salvar a foto. Tente novamente.'},502)
      return response({ok:true})
    }
    const body=await request.json().catch(()=>({})) as Record<string,unknown>
    const action=String(body.action||'')
    // Professional cleanup uses the bearer JWT and verifies the student is
    // actually assigned to this coach. It is called BEFORE deleting the
    // student record, so it can safely remove private storage objects.
    if (action==='cleanup-student') {
      const token=(request.headers.get('authorization')||'').replace(/^Bearer\\s+/i,'').trim()
      if (!token) return response({error:'Sessão profissional necessária.'},401)
      const {data:identity,error:authError}=await admin.auth.getUser(token)
      const userId=identity?.user?.id || ''
      if (authError || !uuid(userId)) return response({error:'Sessão inválida.'},403)
      const studentId=String(body.studentId||'')
      if (!uuid(studentId)) return response({error:'Aluno inválido.'},400)
      const {data:student,error:studentError}=await admin.from('students')
        .select('id').eq('id',studentId).eq('coach_id',userId).maybeSingle()
      if (studentError || !student) return response({error:'Aluno não autorizado.'},403)
      const {data:logs,error:logsError}=await admin.from('student_meal_logs')
        .select('photo_path').eq('coach_id',userId).eq('student_id',studentId)
      if (logsError) return response({error:'Falha ao consultar as fotos privadas.'},503)
      const paths=(logs||[]).map(x=>String(x.photo_path||'')).filter(Boolean)
      for (let offset=0; offset<paths.length; offset+=100) {
        const {error:removeError}=await admin.storage.from(BUCKET).remove(paths.slice(offset,offset+100))
        if (removeError) return response({error:'Falha ao remover as fotos privadas.'},502)
      }
      return response({ok:true,removed:paths.length})
    }
    if (!['sign','remove'].includes(action)) return response({error:'Ação inválida.'},400)
    const actor=await access(admin,String(body.inviteCode||'').trim())
    if (!actor) return response({error:'Acesso não autorizado.'},403)
    const meal=await record(admin,String(body.recordId||''),actor)
    if (!meal) return response({error:'Registro não encontrado.'},404)
    if (action==='sign') {
      const {data,error}=await admin.storage.from(BUCKET).createSignedUrl(meal.photo_path,3600)
      if (error || !data?.signedUrl) return response({error:'Não foi possível abrir a imagem.'},404)
      return response({ok:true,signedUrl:data.signedUrl,expiresIn:3600})
    }
    const {error}=await admin.storage.from(BUCKET).remove([meal.photo_path])
    if (error) return response({error:'Não foi possível remover a foto.'},502)
    return response({ok:true})
  } catch {
    return response({error:'Não foi possível concluir a operação com a foto.'},500)
  }
})
