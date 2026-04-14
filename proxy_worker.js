/**
 * STEALTH_V5 Secure Proxy Worker
 * 
 * Deployment Instructions in Cloudflare:
 * 1. Go to Cloudflare Dashboard -> Workers & Pages -> Create Worker
 * 2. Name it (e.g. "stealth-proxy") and click Deploy.
 * 3. Click "Edit code", paste this entire script, and click "Deploy".
 * 4. Go to Worker Settings -> Variables -> Environment Variables:
 *    - Add `SECURE_PIN` : Your chosen 6-digit PIN (e.g., "123456") (Leave Encrypt checked for safety)
 *    - Add `GITHUB_PAT` : Your GitHub Fine-Grained PAT (Check "Encrypt" to keep it secret)
 * 
 * Then update `index.html` on your public repo to point to this worker's URL.
 */

export default {
    async fetch(request, env, ctx) {
      // 1. Handle CORS Preflight (OPTIONS request)
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*", // Or specify "https://manujg.com" for stricter security
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Sec-PIN, Accept",
            "Access-Control-Max-Age": "86400",
          }
        });
      }
  
      // Base CORS headers to attach to all actual responses
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-Sec-PIN, Accept",
      };
  
      // 2. Extract specific headers
      const clientPin = request.headers.get("X-Sec-PIN");
      const url = new URL(request.url);
      
      // The worker will be accessed like: https://stealth-proxy.yourname.workers.dev/repos/manujguptain/sys-patch-4802-lib/contents/...
      const githubApiPath = url.pathname + url.search;
  
      // 3. Simple static validation
      if (!clientPin || clientPin !== env.SECURE_PIN) {
        return new Response(JSON.stringify({ error: "Unauthorized. Invalid PIN." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
  
      // Prevent accidental infinite loops if misconfigured
      if (!env.GITHUB_PAT) {
        return new Response("Missing GITHUB_PAT in worker environment", { status: 500, headers: corsHeaders });
      }
  
      // 4. Construct the real request to GitHub
      const githubUrl = `https://api.github.com${githubApiPath}`;
      
      // Construct new headers (DO NOT pass through all headers like Origin/Host, build clean ones)
      const githubHeaders = new Headers();
      githubHeaders.set("Authorization", `token ${env.GITHUB_PAT}`);
      githubHeaders.set("User-Agent", "Stealth-V5-Proxy Worker");
      
      // Forward the Accept header if it exists (crucial for raw content in this project)
      const acceptHeader = request.headers.get("Accept");
      if (acceptHeader) {
          githubHeaders.set("Accept", acceptHeader);
      }
      
      // Pass Content-Type if it exists
      const contentType = request.headers.get("Content-Type");
      if (contentType) {
          githubHeaders.set("Content-Type", contentType);
      }
  
      const fetchOptions = {
        method: request.method,
        headers: githubHeaders,
      };
  
      // Attach body for PUT/POST/PATCH
      if (request.method !== "GET" && request.method !== "HEAD") {
        fetchOptions.body = await request.text();
      }
  
      // 5. Fetch from GitHub API
      try {
        const githubResponse = await fetch(githubUrl, fetchOptions);
        
        // Return the response back to the client, preserving CORS
        const responseHeaders = new Headers(githubResponse.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        
        return new Response(githubResponse.body, {
          status: githubResponse.status,
          statusText: githubResponse.statusText,
          headers: responseHeaders
        });
        
      } catch (err) {
        return new Response(JSON.stringify({ error: "Proxy fetch failed", details: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
  };
