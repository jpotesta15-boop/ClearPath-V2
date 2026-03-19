/**
 * Paste into n8n Code node OR used by build script for clearpath-drive-url-cloudconvert-import.json
 * Requires n8n env vars (Settings → Variables).
 */
const file = $input.first().json;
const id = file.id;
const name = (file.name || 'video.mp4').trim();
const folderId = file.parents && file.parents[0] ? String(file.parents[0]).trim() : '';
const mime = file.mimeType || '';

if (
  !mime.startsWith('video/') &&
  !/\.(mp4|mov|webm|mkv|avi|m4v|mpeg|mpg)$/i.test(name)
) {
  return [{ json: { skipped: true, reason: 'not a video file' } }];
}

const clientId = $env.GOOGLE_CLIENT_ID;
const clientSecret = $env.GOOGLE_CLIENT_SECRET;
const refreshToken = $env.GOOGLE_DRIVE_REFRESH_TOKEN;
const ccKey = $env.CLOUDCONVERT_API_KEY;
const cloudName = $env.CLOUDINARY_CLOUD_NAME;
const uploadPreset = $env.CLOUDINARY_UPLOAD_PRESET;
const appUrl = String($env.CLEARPATH_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const cbSecret = $env.N8N_CALLBACK_SECRET;

if (!id || !clientId || !clientSecret || !refreshToken || !ccKey || !cloudName || !uploadPreset || !cbSecret) {
  throw new Error(
    'Set n8n variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN, CLOUDCONVERT_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, N8N_CALLBACK_SECRET, CLEARPATH_APP_URL'
  );
}

const tokenRes = await this.helpers.httpRequest({
  method: 'POST',
  url: 'https://oauth2.googleapis.com/token',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body:
    'grant_type=refresh_token&refresh_token=' +
    encodeURIComponent(refreshToken) +
    '&client_id=' +
    encodeURIComponent(clientId) +
    '&client_secret=' +
    encodeURIComponent(clientSecret),
  json: true,
});
if (!tokenRes.access_token) throw new Error('Google token: ' + JSON.stringify(tokenRes));

const safeName = name.replace(/[^\w.\-()+ ]/g, '_').substring(0, 200) || 'video.mp4';
const jobRes = await this.helpers.httpRequest({
  method: 'POST',
  url: 'https://sync.api.cloudconvert.com/v2/jobs',
  headers: { Authorization: 'Bearer ' + ccKey, 'Content-Type': 'application/json' },
  body: {
    tasks: {
      import_drive: {
        operation: 'import/url',
        url: 'https://www.googleapis.com/drive/v3/files/' + id + '?alt=media',
        filename: safeName,
        headers: { Authorization: 'Bearer ' + tokenRes.access_token },
      },
      to_mp4: { operation: 'convert', input: 'import_drive', output_format: 'mp4' },
      out_url: { operation: 'export/url', input: 'to_mp4' },
    },
  },
  json: true,
});

const tasks = jobRes.data?.tasks || [];
const ex = tasks.find((t) => t.operation === 'export/url' && t.status === 'finished');
const mp4 = ex?.result?.files?.[0]?.url;
if (!mp4) throw new Error('CloudConvert failed: ' + (jobRes.data?.status || JSON.stringify(tasks)));

const cRes = await this.helpers.httpRequest({
  method: 'POST',
  url: 'https://api.cloudinary.com/v1_1/' + cloudName + '/video/upload',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'file=' + encodeURIComponent(mp4) + '&upload_preset=' + encodeURIComponent(uploadPreset),
  json: true,
});
if (!cRes.secure_url) throw new Error('Cloudinary: ' + JSON.stringify(cRes));

const resolve = await this.helpers.httpRequest({
  method: 'GET',
  url: appUrl + '/api/videos/resolve-folder?folderId=' + encodeURIComponent(folderId),
  headers: { 'X-Clearpath-Secret': cbSecret },
  json: true,
});
if (!resolve.workspaceId) throw new Error('Folder not registered in ClearPath: ' + folderId);

const title = name.replace(/\.(mp4|mov|webm|mkv|avi|m4v)$/i, '') || 'video';
const thumb = cRes.secure_url.includes('/upload/')
  ? cRes.secure_url.replace('/upload/', '/upload/so_0/')
  : null;

const fin = await this.helpers.httpRequest({
  method: 'POST',
  url: appUrl + '/api/videos/from-n8n',
  headers: { 'Content-Type': 'application/json', 'X-Clearpath-Secret': cbSecret },
  body: {
    workspaceId: resolve.workspaceId,
    coachId: resolve.coachId,
    title,
    playbackUrl: cRes.secure_url,
    thumbnailUrl: thumb,
    durationSeconds: cRes.duration != null ? Math.round(cRes.duration) : null,
    fileSizeBytes: cRes.bytes != null ? cRes.bytes : null,
  },
  json: true,
});

return [{ json: { ok: true, playbackUrl: cRes.secure_url, clearpathResponse: fin } }];
