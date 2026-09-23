// Vercel Serverless Function to expose Environment Variables to the frontend
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  const backendUrl = 
    process.env.BACKEND_URL || 
    process.env.SERVER_URL || 
    process.env.NEXT_PUBLIC_SERVER_URL || 
    process.env.COOLIFY_URL || 
    process.env.PUBLIC_BACKEND_URL || 
    '';

  res.status(200).json({
    backendUrl: backendUrl.trim().replace(/\/$/, '')
  });
};
