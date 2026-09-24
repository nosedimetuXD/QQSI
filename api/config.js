// Vercel Serverless Function to expose Environment Variables to the frontend
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const backendUrl = 
    process.env.BACKEND_URL || 
    process.env.SERVER_URL || 
    process.env.NEXT_PUBLIC_SERVER_URL || 
    process.env.COOLIFY_URL || 
    process.env.PUBLIC_BACKEND_URL || 
    'https://qqsi.147.5.103.87.sslip.io';

  res.status(200).json({
    backendUrl: backendUrl.trim().replace(/\/$/, '')
  });
};
