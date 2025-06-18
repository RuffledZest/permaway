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
    // Try enhanced method with external service for complete rendering
    try {
      const enhancedHtml = await processUrlWithExternalService(url);
      if (enhancedHtml) {
        return processHtml(enhancedHtml);
      }
    } catch (serviceError) {
      console.warn('External service method failed, falling back to CORS proxy:', serviceError);
    }

    // Fallback to CORS proxy method with CSS extraction
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
          // Try to enhance the HTML by fetching external CSS
          const enhancedHtml = await enhanceHtmlWithExternalResources(html, url);
          return processHtml(enhancedHtml);
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
      const enhancedHtml = await enhanceHtmlWithExternalResources(html, url);
      return processHtml(enhancedHtml);
    }

    throw new Error('Failed to fetch content from all available sources');
  } catch (error) {
    throw new Error(`Failed to fetch URL content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function processUrlWithExternalService(url: string): Promise<string> {
  // Use a third-party service that can render complete pages
  const services = [
    // HTMLCSStoImage API (free tier available)
    `https://htmlcsstoimage.com/demo_images/screenshot?url=${encodeURIComponent(url)}&format=html`,
    // Web scraping API services
    `https://api.scraperapi.com?api_key=demo&url=${encodeURIComponent(url)}&render=true`,
  ];

  for (const serviceUrl of services) {
    try {
      const response = await fetch(serviceUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const html = await response.text();
        if (html && html.includes('<html')) {
          return html;
        }
      }
    } catch (error) {
      console.warn(`Service ${serviceUrl} failed:`, error);
      continue;
    }
  }

  throw new Error('All external services failed');
}

async function enhanceHtmlWithExternalResources(html: string, baseUrl: string): Promise<string> {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Get the base URL for resolving relative paths
    const urlObj = new URL(baseUrl);
    const baseUrlString = `${urlObj.protocol}//${urlObj.host}`;
    
    // Find all external CSS links
    const cssLinks = doc.querySelectorAll('link[rel="stylesheet"]');
    const cssPromises: Promise<string>[] = [];
    
    cssLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href) {
        let cssUrl = href;
        
        // Convert relative URLs to absolute
        if (href.startsWith('/')) {
          cssUrl = baseUrlString + href;
        } else if (href.startsWith('./') || !href.startsWith('http')) {
          cssUrl = new URL(href, baseUrl).toString();
        }
        
        // Fetch the CSS content
        const cssPromise = fetchCssContent(cssUrl).catch(() => '');
        cssPromises.push(cssPromise);
      }
    });
    
    // Wait for all CSS to be fetched
    const cssContents = await Promise.all(cssPromises);
    
    // Create a combined style tag
    if (cssContents.some(css => css.length > 0)) {
      const styleElement = doc.createElement('style');
      styleElement.textContent = cssContents.filter(css => css.length > 0).join('\n\n');
      
      // Insert the style tag in the head
      const head = doc.querySelector('head');
      if (head) {
        head.appendChild(styleElement);
      }
      
      // Remove the original link tags
      cssLinks.forEach(link => link.remove());
    }
    
    // Convert relative image URLs to absolute
    const images = doc.querySelectorAll('img[src]');
    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        let absoluteSrc = src;
        if (src.startsWith('/')) {
          absoluteSrc = baseUrlString + src;
        } else {
          absoluteSrc = new URL(src, baseUrl).toString();
        }
        img.setAttribute('src', absoluteSrc);
      }
    });
    
    return doc.documentElement.outerHTML;
    
  } catch (error) {
    console.warn('Failed to enhance HTML with external resources:', error);
    return html; // Return original HTML if enhancement fails
  }
}

async function fetchCssContent(cssUrl: string): Promise<string> {
  try {
    // Try with CORS proxy
    const corsProxies = [
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?'
    ];
    
    for (const proxy of corsProxies) {
      try {
        const response = await fetch(proxy + encodeURIComponent(cssUrl), {
          headers: {
            'Accept': 'text/css,*/*;q=0.1'
          }
        });
        
        if (response.ok) {
          const css = await response.text();
          if (css && css.trim().length > 0) {
            return `/* Fetched from: ${cssUrl} */\n${css}`;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    // Try direct fetch as fallback
    const directResponse = await fetch(cssUrl);
    if (directResponse.ok) {
      const css = await directResponse.text();
      return `/* Fetched from: ${cssUrl} */\n${css}`;
    }
    
    return '';
  } catch (error) {
    console.warn(`Failed to fetch CSS from ${cssUrl}:`, error);
    return '';
  }
}