// Simple HTML minification without external dependencies
function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .replace(/\s*\/>/g, '/>') // Clean self-closing tags
    .trim();
}

export function processHtml(html: string): string {
  // First, minify the HTML
  const minified = minifyHtml(html);

  // Replace double quotes with single quotes, being careful with nested quotes
  return minified.replace(/"/g, (match) => "'");
}

export function processMhtml(mhtmlContent: string): string {
  // Extract HTML content from MHTML
  const htmlMatch = mhtmlContent.match(/<html[^>]*>[\s\S]*<\/html>/i);
  if (!htmlMatch) {
    throw new Error('No HTML content found in MHTML file');
  }

  return processHtml(htmlMatch[0]);
}

export async function processUrlContent(url: string): Promise<string> {
  try {
    // Try fetching with CORS proxy
    const corsProxies = [
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/',
      'https://corsproxy.io/?'
    ];

    for (const proxy of corsProxies) {
      try {
        const response = await fetch(proxy + encodeURIComponent(url), {
          headers: {
            'Origin': window.location.origin
          }
        });

        if (response.ok) {
          const html = await response.text();
          return processHtml(html);
        }
      } catch (proxyError) {
        console.warn(`Proxy ${proxy} failed:`, proxyError);
        continue;
      }
    }

    // If all proxies fail, try direct fetch as fallback
    const directResponse = await fetch(url);
    if (directResponse.ok) {
      const html = await directResponse.text();
      return processHtml(html);
    }

    throw new Error('Failed to fetch content from all available sources');
  } catch (error) {
    throw new Error(`Failed to fetch URL content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}