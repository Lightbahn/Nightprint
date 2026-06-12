// /api/geo.js
// Combined server-side proxy for the external geo services Nightprint relies on.
// Routes that browsers can't call reliably (Nominatim's UA policy, Overpass
// CORS/rate limits, lightpollutionmap) all go through here.
//
// Usage from the client:
//   /api/geo?type=geocode&q=Ottawa
//   /api/geo?type=bortle&lat=45.4&lon=-75.7
//   /api/geo?type=overpass   (POST, body = the Overpass QL string)

export default async function handler(req, res) {
  const type = req.query.type;

  try {
    if (type === 'geocode') {
      const q = (req.query.q || '').trim();
      if (!q) return res.status(400).json({ error: 'Missing q' });
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Nightprint/1.0 (https://nightprint.co; info@lightbahn.ca)',
          'Accept-Language': 'en',
          'Referer': 'https://nightprint.co'
        }
      });
      if (!r.ok) return res.status(r.status).json({ error: `Geocoder ${r.status}` });
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      return res.status(200).json(await r.json());
    }

    if (type === 'bortle') {
      const { lat, lon } = req.query;
      if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });
      const url = `https://www.lightpollutionmap.info/QueryRaster/?ql=wa_2015&qt=point&qd=${lon},${lat}`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Nightprint/1.0 (https://nightprint.co)' }
      });
      if (!r.ok) return res.status(r.status).json({ error: `Bortle ${r.status}` });
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      return res.status(200).json(await r.json());
    }

    if (type === 'overpass') {
      // Expect the Overpass QL query as the raw POST body.
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'User-Agent': 'Nightprint/1.0 (https://nightprint.co)' },
        body
      });
      if (!r.ok) return res.status(r.status).json({ error: `Overpass ${r.status}` });
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return res.status(200).json(await r.json());
    }

    return res.status(400).json({ error: 'Unknown type' });
  } catch (e) {
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}
