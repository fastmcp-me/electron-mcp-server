/**
 * Enhanced input interaction commands for React-based Electron applications
 * Focuses on proper event handling and React state management
 */

/**
 * Generate the enhanced fill_input command with React-aware event handling
 */
export function generateFillInputCommand(selector: string, value: string, searchText: string): string {
  return `
    (function() {
      const selector = '${selector}';
      const value = '${value}';
      const searchText = '${searchText}';
      
      // Deep form field analysis
      function analyzeInput(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const label = findAssociatedLabel(el);
        
        return {
          element: el,
          type: el.type || el.tagName.toLowerCase(),
          placeholder: el.placeholder || '',
          name: el.name || '',
          id: el.id || '',
          value: el.value || '',
          label: label ? label.textContent.trim() : '',
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaDescribedBy: el.getAttribute('aria-describedby') || '',
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
          isEnabled: !el.disabled && !el.readOnly,
          rect: rect,
          context: getInputContext(el)
        };
      }
      
      // Find associated label for an input
      function findAssociatedLabel(input) {
        // Method 1: Label with for attribute
        if (input.id) {
          const label = document.querySelector(\`label[for="\${input.id}"]\`);
          if (label) return label;
        }
        
        // Method 2: Input nested inside label
        let parent = input.parentElement;
        while (parent && parent.tagName !== 'BODY') {
          if (parent.tagName === 'LABEL') return parent;
          parent = parent.parentElement;
        }
        
        // Method 3: aria-labelledby
        const labelledBy = input.getAttribute('aria-labelledby');
        if (labelledBy) {
          const label = document.getElementById(labelledBy);
          if (label) return label;
        }
        
        // Method 4: Look for nearby text elements
        const siblings = Array.from(input.parentElement?.children || []);
        for (let sibling of siblings) {
          if (sibling !== input && sibling.textContent?.trim()) {
            const siblingRect = sibling.getBoundingClientRect();
            const inputRect = input.getBoundingClientRect();
            
            // Check if sibling is close to input (likely a label)
            if (Math.abs(siblingRect.bottom - inputRect.top) < 50 || 
                Math.abs(siblingRect.right - inputRect.left) < 200) {
              return sibling;
            }
          }
        }
        
        return null;
      }
      
      // Get surrounding context for better understanding
      function getInputContext(input) {
        const context = [];
        
        // Get form context
        const form = input.closest('form');
        if (form) {
          const formTitle = form.querySelector('h1, h2, h3, h4, h5, h6');
          if (formTitle) context.push('Form: ' + formTitle.textContent.trim());
        }
        
        // Get fieldset context
        const fieldset = input.closest('fieldset');
        if (fieldset) {
          const legend = fieldset.querySelector('legend');
          if (legend) context.push('Fieldset: ' + legend.textContent.trim());
        }
        
        // Get section context
        const section = input.closest('section, div[class*="section"], div[class*="group"]');
        if (section) {
          const heading = section.querySelector('h1, h2, h3, h4, h5, h6, .title, .heading');
          if (heading) context.push('Section: ' + heading.textContent.trim());
        }
        
        return context.join(', ');
      }
      
      // Score input field relevance
      function scoreInput(analysis, target) {
        let score = 0;
        const targetLower = target.toLowerCase();
        
        // Text matching
        const texts = [
          analysis.placeholder,
          analysis.label,
          analysis.ariaLabel,
          analysis.name,
          analysis.id,
          analysis.context
        ].map(t => (t || '').toLowerCase());
        
        for (let text of texts) {
          if (text === targetLower) score += 100;
          else if (text.includes(targetLower)) score += 50;
          else if (targetLower.includes(text) && text.length > 2) score += 30;
        }
        
        // Fuzzy matching
        for (let text of texts) {
          if (text.length > 2) {
            const similarity = calculateSimilarity(text, targetLower);
            score += similarity * 25;
          }
        }
        
        // Bonus for visible and enabled
        if (analysis.isVisible && analysis.isEnabled) score += 20;
        
        // Bonus for text/password/email inputs (more likely to be forms)
        if (['text', 'password', 'email', 'search', 'textarea'].includes(analysis.type)) score += 10;
        
        // Penalty for hidden/system fields
        if (analysis.type === 'hidden' || analysis.name?.includes('csrf')) score -= 50;
        
        return score;
      }
      
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
      
      // Enhanced input filling for React components
      function fillInputValue(element, newValue) {
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Focus the element first
        element.focus();
        
        // For React components, we need to trigger the right events
        
        // Method 1: Direct value assignment with React events
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        
        if (element.tagName === 'INPUT' && nativeInputValueSetter) {
          nativeInputValueSetter.call(element, newValue);
        } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
          nativeTextAreaValueSetter.call(element, newValue);
        } else {
          element.value = newValue;
        }
        
        // Create and dispatch React-compatible events
        const events = [
          new Event('input', { bubbles: true, cancelable: true }),
          new Event('change', { bubbles: true, cancelable: true }),
          new KeyboardEvent('keydown', { bubbles: true, cancelable: true }),
          new KeyboardEvent('keyup', { bubbles: true, cancelable: true }),
        ];
        
        events.forEach(event => {
          element.dispatchEvent(event);
        });
        
        // Method 2: Simulate typing for more realistic interaction
        if (window.React || window._reactInternalInstance || element._reactInternalFiber) {
          // Clear existing content first
          element.select();
          document.execCommand('delete');
          
          // Type character by character
          newValue.split('').forEach((char, index) => {
            setTimeout(() => {
              element.value += char;
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }, index * 10);
          });
          
          // Final change event
          setTimeout(() => {
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }, newValue.length * 10 + 50);
        }
        
        // Method 3: Fallback for contenteditable elements
        if (element.contentEditable === 'true') {
          element.textContent = newValue;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Trigger form validation if present
        if (element.form && element.form.checkValidity) {
          setTimeout(() => {
            element.form.checkValidity();
          }, 100);
        }
        
        return true;
      }
      
      let targetElement = null;
      
      // Method 1: Try by selector first if provided
      if (selector) {
        targetElement = document.querySelector(selector);
        if (targetElement) {
          const analysis = analyzeInput(targetElement);
          if (analysis.isVisible && analysis.isEnabled) {
            // Element found by selector, proceed to fill
          } else {
            targetElement = null; // Reset if not usable
          }
        }
      }
      
      // Method 2: Intelligent search if no selector or selector failed
      if (!targetElement && searchText) {
        const inputs = document.querySelectorAll('input, textarea, select, [contenteditable="true"]');
        const candidates = [];
        
        for (let input of inputs) {
          const analysis = analyzeInput(input);
          if (analysis.isVisible && analysis.isEnabled) {
            const score = scoreInput(analysis, searchText);
            if (score > 10) {
              candidates.push({ ...analysis, score });
            }
          }
        }
        
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          targetElement = candidates[0].element;
          
          // Log the decision for debugging
          console.log('Input selection:', {
            searched: searchText,
            found: candidates[0].label || candidates[0].placeholder || candidates[0].name,
            score: candidates[0].score,
            alternatives: candidates.slice(1, 3).map(c => ({
              label: c.label || c.placeholder || c.name,
              score: c.score
            }))
          });
        }
      }
      
      if (!targetElement) {
        return \`No suitable input found for: "\${searchText || selector}". Available inputs: \${
          Array.from(document.querySelectorAll('input, textarea')).map(inp => {
            const analysis = analyzeInput(inp);
            return analysis.label || analysis.placeholder || analysis.name || analysis.type;
          }).filter(Boolean).join(', ')
        }\`;
      }
      
      // Fill the input with enhanced interaction
      try {
        const success = fillInputValue(targetElement, value);
        
        if (success) {
          const analysis = analyzeInput(targetElement);
          return \`Successfully filled input "\${analysis.label || analysis.placeholder || analysis.name || 'unknown'}" with: "\${value}"\`;
        } else {
          return \`Failed to fill input value\`;
        }
      } catch (error) {
        return \`Failed to fill input: \${error.message}\`;
      }
    })()
  `;
}

/**
 * Generate the enhanced select_option command
 */
export function generateSelectOptionCommand(selector: string, value: string, text: string): string {
  return `
    (function() {
      const selector = '${selector}';
      const value = '${value}';
      const text = '${text}';
      
      let select = null;
      
      // Try by selector first
      if (selector) {
        select = document.querySelector(selector);
      }
      
      // Try by label text
      if (!select && text) {
        const selects = document.querySelectorAll('select');
        for (let sel of selects) {
          const label = document.querySelector(\`label[for="\${sel.id}"]\`);
          if (label && label.textContent?.toLowerCase().includes(text.toLowerCase())) {
            select = sel;
            break;
          }
        }
      }
      
      if (select) {
        // Try to find option by value or text
        const options = select.querySelectorAll('option');
        for (let option of options) {
          if (option.value === value || option.textContent?.trim().toLowerCase().includes(value.toLowerCase())) {
            select.value = option.value;
            
            // Trigger React-compatible events
            select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            select.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            
            return \`Selected option "\${option.textContent?.trim()}" in select "\${select.name || 'unknown'}"\`;
          }
        }
        return \`Option "\${value}" not found in select\`;
      }
      
      return \`No select found with selector: "\${selector}" or text: "\${text}"\`;
    })()
  `;
}

/**
 * Generate page structure analysis command
 */
export function generatePageStructureCommand(): string {
  return `
    (function() {
      const structure = {
        title: document.title,
        url: window.location.href,
        buttons: [],
        inputs: [],
        selects: [],
        links: [],
        framework: detectFramework()
      };
      
      function detectFramework() {
        if (window.React || document.querySelector('[data-reactroot]')) return 'React';
        if (window.Vue || document.querySelector('[data-v-]')) return 'Vue';
        if (window.angular || document.querySelector('[ng-version]')) return 'Angular';
        return 'Unknown';
      }
      
      // Get buttons with enhanced analysis
      document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          structure.buttons.push({
            text: el.textContent?.trim() || el.value || '',
            id: el.id || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            className: el.className || '',
            type: el.type || 'button',
            disabled: el.disabled,
            visible: !el.hidden && getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      // Get inputs with enhanced analysis
      document.querySelectorAll('input, textarea').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const label = document.querySelector(\`label[for="\${el.id}"]\`);
          structure.inputs.push({
            type: el.type || 'text',
            placeholder: el.placeholder || '',
            label: label?.textContent?.trim() || '',
            id: el.id || '',
            name: el.name || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            value: el.value || '',
            required: el.required,
            disabled: el.disabled,
            readOnly: el.readOnly,
            visible: !el.hidden && getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      // Get selects with enhanced analysis
      document.querySelectorAll('select').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const label = document.querySelector(\`label[for="\${el.id}"]\`);
          const options = Array.from(el.options).map(opt => ({ 
            value: opt.value, 
            text: opt.textContent?.trim(),
            selected: opt.selected 
          }));
          structure.selects.push({
            label: label?.textContent?.trim() || '',
            id: el.id || '',
            name: el.name || '',
            options: options,
            selectedValue: el.value,
            multiple: el.multiple,
            disabled: el.disabled,
            visible: !el.hidden && getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      // Get links with enhanced analysis
      document.querySelectorAll('a[href]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          structure.links.push({
            text: el.textContent?.trim() || '',
            href: el.href,
            id: el.id || '',
            target: el.target || '',
            visible: !el.hidden && getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      return JSON.stringify(structure, null, 2);
    })()
  `;
}
