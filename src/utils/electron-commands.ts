/**
 * Enhanced Electron interaction commands for React-based applications
 * Addresses common issues with form interactions, event handling, and state management
 */

export interface ElementAnalysis {
  element?: Element;
  tag: string;
  text: string;
  id: string;
  className: string;
  name: string;
  placeholder: string;
  type: string;
  value: string;
  ariaLabel: string;
  ariaRole: string;
  title: string;
  href: string;
  src: string;
  alt: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  isInteractive: boolean;
  zIndex: number;
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  cursor: string;
  context: string;
  selector: string;
  xpath: string;
}

export interface PageAnalysis {
  clickable: ElementAnalysis[];
  inputs: ElementAnalysis[];
  links: ElementAnalysis[];
  images: ElementAnalysis[];
  text: ElementAnalysis[];
  containers: ElementAnalysis[];
  metadata: {
    totalElements: number;
    visibleElements: number;
    interactiveElements: number;
    pageTitle: string;
    pageUrl: string;
    viewport: {
      width: number;
      height: number;
    };
  };
}

/**
 * Generate the enhanced find_elements command with deep DOM analysis
 */
export function generateFindElementsCommand(): string {
  return `
    (function() {
      // Deep DOM analysis functions
      function analyzeElement(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().substring(0, 100),
          id: el.id || '',
          className: el.className || '',
          name: el.name || '',
          placeholder: el.placeholder || '',
          type: el.type || '',
          value: el.value || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaRole: el.getAttribute('role') || '',
          title: el.title || '',
          href: el.href || '',
          src: el.src || '',
          alt: el.alt || '',
          position: { 
            x: Math.round(rect.left), 
            y: Math.round(rect.top), 
            width: Math.round(rect.width), 
            height: Math.round(rect.height) 
          },
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity > 0,
          isInteractive: isInteractiveElement(el),
          zIndex: parseInt(style.zIndex) || 0,
          backgroundColor: style.backgroundColor,
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          cursor: style.cursor,
          context: getElementContext(el),
          selector: generateSelector(el),
          xpath: generateXPath(el)
        };
      }
      
      function isInteractiveElement(el) {
        const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
        const interactiveTypes = ['button', 'submit', 'reset', 'checkbox', 'radio'];
        const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'option'];
        
        return interactiveTags.includes(el.tagName) ||
               interactiveTypes.includes(el.type) ||
               interactiveRoles.includes(el.getAttribute('role')) ||
               el.hasAttribute('onclick') ||
               el.hasAttribute('onsubmit') ||
               el.getAttribute('contenteditable') === 'true' ||
               getComputedStyle(el).cursor === 'pointer';
      }
      
      function getElementContext(el) {
        const context = [];
        
        // Get form context
        const form = el.closest('form');
        if (form) {
          const formTitle = form.querySelector('h1, h2, h3, h4, h5, h6, .title');
          if (formTitle) context.push('Form: ' + formTitle.textContent.trim().substring(0, 50));
        }
        
        // Get parent container context
        const container = el.closest('section, article, div[class*="container"], div[class*="card"], div[class*="panel"]');
        if (container && container !== form) {
          const heading = container.querySelector('h1, h2, h3, h4, h5, h6, .title, .heading');
          if (heading) context.push('Container: ' + heading.textContent.trim().substring(0, 50));
        }
        
        // Get nearby labels
        const label = findElementLabel(el);
        if (label) context.push('Label: ' + label.substring(0, 50));
        
        return context.join(' | ');
      }
      
      function findElementLabel(el) {
        // For inputs, find associated label
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          if (el.id) {
            const label = document.querySelector(\`label[for="\${el.id}"]\`);
            if (label) return label.textContent.trim();
          }
          
          // Check if nested in label
          const parentLabel = el.closest('label');
          if (parentLabel) return parentLabel.textContent.trim();
          
          // Check aria-labelledby
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const labelEl = document.getElementById(labelledBy);
            if (labelEl) return labelEl.textContent.trim();
          }
        }
        
        return '';
      }
      
      function generateSelector(el) {
        // Generate a robust CSS selector
        if (el.id) return '#' + el.id;
        
        let selector = el.tagName.toLowerCase();
        
        if (el.className) {
          const classes = el.className.split(' ').filter(c => c && !c.match(/^(ng-|v-|_)/));
          if (classes.length > 0) {
            selector += '.' + classes.slice(0, 3).join('.');
          }
        }
        
        // Add attribute selectors for better specificity
        if (el.name) selector += \`[name="\${el.name}"]\`;
        if (el.type && el.tagName === 'INPUT') selector += \`[type="\${el.type}"]\`;
        if (el.placeholder) selector += \`[placeholder*="\${el.placeholder.substring(0, 20)}"]\`;
        
        return selector;
      }
      
      function generateXPath(el) {
        if (el.id) return \`//*[@id="\${el.id}"]\`;
        
        let path = '';
        let current = el;
        
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          
          if (current.id) {
            path = \`//*[@id="\${current.id}"]\` + path;
            break;
          }
          
          const siblings = Array.from(current.parentNode?.children || []).filter(
            sibling => sibling.tagName === current.tagName
          );
          
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += \`[\${index}]\`;
          }
          
          path = '/' + selector + path;
          current = current.parentElement;
        }
        
        return path || '//body' + path;
      }
      
      // Categorize elements by type
      const analysis = {
        clickable: [],
        inputs: [],
        links: [],
        images: [],
        text: [],
        containers: [],
        metadata: {
          totalElements: 0,
          visibleElements: 0,
          interactiveElements: 0,
          pageTitle: document.title,
          pageUrl: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };
      
      // Analyze all elements
      const allElements = document.querySelectorAll('*');
      analysis.metadata.totalElements = allElements.length;
      
      for (let el of allElements) {
        const elementAnalysis = analyzeElement(el);
        
        if (!elementAnalysis.isVisible) continue;
        analysis.metadata.visibleElements++;
        
        if (elementAnalysis.isInteractive) {
          analysis.metadata.interactiveElements++;
          
          // Categorize clickable elements
          if (['button', 'a', 'input'].includes(elementAnalysis.tag) || 
              ['button', 'submit'].includes(elementAnalysis.type) ||
              elementAnalysis.ariaRole === 'button') {
            analysis.clickable.push(elementAnalysis);
          }
        }
        
        // Categorize inputs
        if (['input', 'textarea', 'select'].includes(elementAnalysis.tag)) {
          analysis.inputs.push(elementAnalysis);
        }
        
        // Categorize links
        if (elementAnalysis.tag === 'a' && elementAnalysis.href) {
          analysis.links.push(elementAnalysis);
        }
        
        // Categorize images
        if (elementAnalysis.tag === 'img') {
          analysis.images.push(elementAnalysis);
        }
        
        // Categorize text elements with significant content
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'].includes(elementAnalysis.tag) &&
            elementAnalysis.text.length > 10 && elementAnalysis.text.length < 200) {
          analysis.text.push(elementAnalysis);
        }
        
        // Categorize important containers
        if (['form', 'section', 'article', 'main', 'nav', 'header', 'footer'].includes(elementAnalysis.tag) ||
            elementAnalysis.className.match(/(container|wrapper|card|panel|modal|dialog)/i)) {
          analysis.containers.push(elementAnalysis);
        }
      }
      
      // Limit results to prevent overwhelming output
      const maxResults = 20;
      Object.keys(analysis).forEach(key => {
        if (Array.isArray(analysis[key]) && analysis[key].length > maxResults) {
          analysis[key] = analysis[key].slice(0, maxResults);
        }
      });
      
      return JSON.stringify(analysis, null, 2);
    })()
  `;
}

/**
 * Generate the enhanced click_by_text command with improved element scoring
 */
export function generateClickByTextCommand(text: string): string {
  return `
    (function() {
      const targetText = '${text}';
      
      // Deep DOM analysis function
      function analyzeElement(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        
        return {
          element: el,
          text: (el.textContent || '').trim(),
          ariaLabel: el.getAttribute('aria-label') || '',
          title: el.title || '',
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
          isInteractive: el.tagName.match(/^(BUTTON|A|INPUT)$/) || el.hasAttribute('onclick') || el.getAttribute('role') === 'button' || style.cursor === 'pointer',
          rect: rect,
          zIndex: parseInt(style.zIndex) || 0,
          opacity: parseFloat(style.opacity) || 1
        };
      }
      
      // Score element relevance
      function scoreElement(analysis, target) {
        let score = 0;
        const text = analysis.text.toLowerCase();
        const label = analysis.ariaLabel.toLowerCase();
        const title = analysis.title.toLowerCase();
        const targetLower = target.toLowerCase();
        
        // Exact match gets highest score
        if (text === targetLower || label === targetLower || title === targetLower) score += 100;
        
        // Starts with target
        if (text.startsWith(targetLower) || label.startsWith(targetLower)) score += 50;
        
        // Contains target
        if (text.includes(targetLower) || label.includes(targetLower) || title.includes(targetLower)) score += 25;
        
        // Fuzzy matching for close matches
        const similarity = Math.max(
          calculateSimilarity(text, targetLower),
          calculateSimilarity(label, targetLower),
          calculateSimilarity(title, targetLower)
        );
        score += similarity * 20;
        
        // Bonus for interactive elements
        if (analysis.isInteractive) score += 10;
        
        // Bonus for visibility
        if (analysis.isVisible) score += 15;
        
        // Bonus for larger elements (more likely to be main buttons)
        if (analysis.rect.width > 100 && analysis.rect.height > 30) score += 5;
        
        // Bonus for higher z-index (on top)
        score += Math.min(analysis.zIndex, 5);
        
        return score;
      }
      
      // Simple string similarity function
      function calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const maxLen = Math.max(len1, len2);
        if (maxLen === 0) return 0;
        
        let matches = 0;
        const minLen = Math.min(len1, len2);
        for (let i = 0; i < minLen; i++) {
          if (str1[i] === str2[i]) matches++;
        }
        return matches / maxLen;
      }
      
      // Find all potentially clickable elements
      const allElements = document.querySelectorAll('*');
      const candidates = [];
      
      for (let el of allElements) {
        const analysis = analyzeElement(el);
        
        if (analysis.isVisible && (analysis.isInteractive || analysis.text || analysis.ariaLabel)) {
          const score = scoreElement(analysis, targetText);
          if (score > 5) { // Only consider elements with some relevance
            candidates.push({ ...analysis, score });
          }
        }
      }
      
      if (candidates.length === 0) {
        return \`No clickable elements found containing text: "\${targetText}"\`;
      }
      
      // Sort by score and get the best match
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      
      // Additional validation before clicking
      if (best.score < 15) {
        return \`Found potential matches but confidence too low (score: \${best.score}). Best match was: "\${best.text || best.ariaLabel}" - try being more specific.\`;
      }
      
      // Enhanced clicking for React components
      function clickElement(element) {
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Focus the element
        if (element.focus) element.focus();
        
        // Create and dispatch multiple events for React compatibility
        const events = [
          new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
          new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
          new MouseEvent('click', { bubbles: true, cancelable: true }),
        ];
        
        events.forEach(event => {
          element.dispatchEvent(event);
        });
        
        // Try programmatic click as fallback
        if (element.click) {
          element.click();
        }
      }
      
      // Wait a moment for scroll, then click
      setTimeout(() => {
        clickElement(best.element);
      }, 100);
      
      return \`Clicked best match (score: \${best.score}): "\${best.text || best.ariaLabel || best.title}" - searched for: "\${targetText}"\`;
    })()
  `;
}
