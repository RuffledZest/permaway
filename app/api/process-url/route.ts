import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Import Puppeteer dynamically to avoid issues during build
    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    // Navigate to the page and wait for it to load completely
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait a bit more for any dynamic content
    await page.waitForTimeout(2000);

    // Inline all CSS and remove external stylesheet links
    await page.evaluate(() => {
      // Get all stylesheets and inline them
      const styleSheets = Array.from(document.styleSheets);
      const combinedStyles: string[] = [];

      for (const sheet of styleSheets) {
        try {
          if (sheet.cssRules) {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              combinedStyles.push(rule.cssText);
            }
          }
        } catch (err) {
          // Cross-origin stylesheet access might throw error
          console.warn('Could not access stylesheet:', err);
        }
      }

      // Create a new style element with all combined styles
      if (combinedStyles.length > 0) {
        const styleTag = document.createElement('style');
        styleTag.textContent = combinedStyles.join('\n');
        document.head.appendChild(styleTag);
      }

      // Remove all external stylesheet links
      const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
      linkElements.forEach(link => link.remove());

      // Also try to inline any @import rules in existing style tags
      const styleTags = document.querySelectorAll('style');
      styleTags.forEach(styleTag => {
        if (styleTag.textContent) {
          // Remove @import statements as they won't work in inline styles
          styleTag.textContent = styleTag.textContent.replace(/@import[^;]+;/g, '');
        }
      });

      // Remove any script tags that might cause issues (optional)
      const scriptTags = document.querySelectorAll('script[src]');
      scriptTags.forEach(script => {
        // Only remove external scripts, keep inline scripts
        if (script.getAttribute('src')?.startsWith('http')) {
          script.remove();
        }
      });
    });

    // Wait a moment for the changes to apply
    await page.waitForTimeout(1000);

    // Get the final HTML content
    const html = await page.content();

    await browser.close();

    // Additional processing to ensure the HTML is self-contained
    const processedHtml = postProcessHtml(html);

    return NextResponse.json({
      success: true,
      html: processedHtml
    });

  } catch (error) {
    console.error('Error processing URL with Puppeteer:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

function postProcessHtml(html: string): string {
  // Additional processing to make the HTML more self-contained
  let processedHtml = html;

  // Remove any remaining external resource references that might cause issues
  processedHtml = processedHtml.replace(/<link[^>]*rel=["'](?:preload|prefetch|dns-prefetch|preconnect)["'][^>]*>/gi, '');
  
  // Remove any remaining external font links (they might not load properly)
  processedHtml = processedHtml.replace(/<link[^>]*href=["'][^"']*fonts[^"']*["'][^>]*>/gi, '');
  
  // Convert relative URLs to absolute URLs for images and other assets
  // This is a basic implementation - you might want to enhance this
  processedHtml = processedHtml.replace(/src=["']\/([^"']*?)["']/gi, (match, path) => {
    // This is a simplified approach - in production you'd want to handle this more carefully
    return match; // For now, keep as is
  });

  return processedHtml;
}