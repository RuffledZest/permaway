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
    // First try the enhanced method with Puppeteer for complete rendering
    try {
      const enhancedHtml = await processUrlWithPuppeteer(url);
      if (enhancedHtml) {
        return processHtml(enhancedHtml);
      }
    } catch (puppeteerError) {
      console.warn('Puppeteer method failed, falling back to CORS proxy:', puppeteerError);
    }

    // Fallback to CORS proxy method
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

async function processUrlWithPuppeteer(url: string): Promise<string> {
  // This function will call our API endpoint that uses Puppeteer
  try {
    const response = await fetch('/api/process-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.html) {
      return data.html;
    } else {
      throw new Error(data.error || 'Failed to process URL with Puppeteer');
    }
  } catch (error) {
    console.error('Error calling Puppeteer API:', error);
    throw error;
  }
}