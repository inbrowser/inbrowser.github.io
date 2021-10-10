/// https://github.com/Ionaru/easy-markdown-editor/blob/master/LICENSE
//
// The MIT License (MIT)
//
// Copyright (c) 2015 Sparksuite, Inc.
// Copyright (c) 2017 Jeroen Akkerman.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/*

////////////////////////// --------------------------- \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
                               IMPORTANT NOTICE
////////////////////////// --------------------------- \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

THIS CLASS IS A COPY OF THE EASY MDE PROVIDING A MARKDOWN EDITOR, THAT WAS TUNED TO REPLACE MARKDOWN
WITH LATEX. THE CODE IS NOW UNREADABLE, AND WON'T BE MAINTAINED. WE WILL MOVE
TO ANOTHER SOLUTION LATER.

////////////////////////// --------------------------- \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

 */

const CLASS_REGEX = {};

/**
 * Convert a className string into a regex for matching (and cache).
 * Note that the RegExp includes trailing spaces for replacement
 * (to ensure that removing a class from the middle of the string will retain
 *  spacing between other classes.)
 * @param {String} className Class name to convert to regex for matching.
 * @returns {RegExp} Regular expression option that will match className.
 */
function getClassRegex(className) {
	return CLASS_REGEX[className] || (CLASS_REGEX[className] = new RegExp('\\s*' + className + '(\\s*)', 'g'));
}

/**
 * Add a class string to an element.
 * @param {Element} el DOM element on which to add className.
 * @param {String} className Class string to apply
 * @returns {void}
 */
function addClass(el, className) {
	if (!el || !className) return;
	const classRegex = getClassRegex(className);
	if (el.className.match(classRegex)) return; // already applied
	el.className += ' ' + className;
}

/**
 * Toggle side by side preview
 */
function toggleSideBySide(editor) {
	const cm = editor.codemirror;
	const wrapper = cm.getWrapperElement();
	const preview = wrapper.nextSibling;

	const easyMDEContainer = wrapper.parentNode;

	setTimeout(function () {
		addClass(easyMDEContainer, 'sided--no-fullscreen');
		preview.className += ' editor-preview-active-side';
	}, 1);
	wrapper.className += ' CodeMirror-sided';

	const sideBySideRenderingFunction = function () {
		const newValue = editor.options.previewRender(editor.value(), preview);
		if (newValue != null) {
			preview.innerHTML = newValue;
		}
	};

	if (!cm.sideBySideRenderingFunction) {
		cm.sideBySideRenderingFunction = sideBySideRenderingFunction;
	}

	const newValue = editor.options.previewRender(editor.value(), preview);
	if (newValue != null)  preview.innerHTML = newValue;
	cm.on('update', cm.sideBySideRenderingFunction);
}

function _replaceSelection(cm, insert) {
	if (/editor-preview-active/.test(cm.getWrapperElement().lastChild.className))
		return;

	let text;
	const startPoint = {}, endPoint = {};
	Object.assign(startPoint, cm.getCursor('start'));
	Object.assign(endPoint, cm.getCursor('end'));

	text = cm.getSelection();
	cm.replaceSelection(text + insert);
	cm.setSelection(startPoint, endPoint);
	cm.focus();
}

// Merge the properties of one object into another.
function _mergeProperties(target, source) {
	for (const property in source) {
		if (Object.prototype.hasOwnProperty.call(source, property)) {
			if (source[property] instanceof Array) {
				target[property] = source[property].concat(target[property] instanceof Array ? target[property] : []);
			} else if (
				source[property] !== null &&
				typeof source[property] === 'object' &&
				source[property].constructor === Object
			) {
				target[property] = _mergeProperties(target[property] || {}, source[property]);
			} else {
				target[property] = source[property];
			}
		}
	}

	return target;
}

// Merge an arbitrary number of objects into one.
function extend(target) {
	for (let i = 1; i < arguments.length; i++) {
		target = _mergeProperties(target, arguments[i]);
	}

	return target;
}

/**
 * Interface of LatexEditor.
 */
function LatexEditor(options) {
	// Handle options parameter
	options = options || {};

	// Used later to refer to it"s parent
	options.parent = this;

	// Find the textarea to use
	if (options.element) {
		this.element = options.element;
	} else if (options.element === null) {
		// This means that the element option was specified, but no element was found
		console.log('LatexEditor: Error. No element was found.');
		return;
	}

	// Editor preview styling class.
	if (!Object.prototype.hasOwnProperty.call(options, 'previewClass')) {
		options.previewClass = 'editor-preview';
	}

	// Add default preview rendering function
	options.previewRender = function(plainText) {
		return katex.renderToString(plainText, {
			"displayMode":true,
			"leqno":false,
			"fleqn":false,
			"throwOnError":false,
			"errorColor":"#cc0000",
			"strict":"error",
			"output":"html",
			"trust":true
		}) // replace \\\\ with a new line
			.replaceAll("<span class=\"mspace\"></span><span class=\"mspace\"></span>", "<br>");
	};

	// Set default options for parsing config
	options.parsingConfig = extend({
		highlightFormatting: true, // needed for toggleCodeBlock to detect types of code
	}, options.parsingConfig || {});

	options.maxHeight = options.maxHeight || undefined;

	options.direction = options.direction || 'ltr';

	if (typeof options.maxHeight !== 'undefined') {
		// Min and max height are equal if maxHeight is set
		options.minHeight = options.maxHeight;
	} else {
		options.minHeight = options.minHeight || '300px';
	}

	options.errorCallback = options.errorCallback || function (errorMessage) {
		alert(errorMessage);
	};

	// If overlay mode is specified and combine is not provided, default it to true
	if (options.overlayMode && options.overlayMode.combine === undefined) {
		options.overlayMode.combine = true;
	}

	// Update this options
	this.options = options;


	// Auto render
	this.render();
}

/**
 * Render editor to the given element.
 */
LatexEditor.prototype.render = function (el) {
	if (!el) {
		el = this.element || document.getElementsByTagName('textarea')[0];
	}

	if (this._rendered && this._rendered === el) {
		// Already rendered.
		return;
	}

	this.element = el;
	const options = this.options;

	this.codemirror = CodeMirror.fromTextArea(el, {
		theme: (options.theme !== undefined) ? options.theme : 'LatexEditor',
		tabSize: 4,
		indentUnit: (options.tabSize !== undefined) ? options.tabSize : 2,
		indentWithTabs: true,
		lineNumbers: (options.lineNumbers === true),
		autofocus: true,
		direction: options.direction,
		lineWrapping: true,
		allowDropFileTypes: ['text/plain'],
		placeholder: options.placeholder || el.getAttribute('placeholder') || '',
		styleSelectedText: true,
		scrollbarStyle: (options.scrollbarStyle !== undefined) ? options.scrollbarStyle : 'native',
		inputStyle: 'textarea',
		spellcheck: false,
		autoRefresh: false,
	});

	this.codemirror.getScrollerElement().style.minHeight = options.minHeight;

	if (typeof options.maxHeight !== 'undefined') {
		this.codemirror.getScrollerElement().style.height = options.maxHeight;
	}

	const cm = this.codemirror;
	cm.on('change', function () {
		cm.save();
	});

	this.gui = {};

	// Wrap Codemirror with container before create toolbar, etc,
	// to use with sideBySideFullscreen option.
	const easyMDEContainer = document.createElement('div');
	easyMDEContainer.classList.add('EasyMDEContainer');
	const cmWrapper = this.codemirror.getWrapperElement();
	cmWrapper.parentNode.insertBefore(easyMDEContainer, cmWrapper);
	easyMDEContainer.appendChild(cmWrapper);

	this.gui.sideBySide = this.createSideBySide();
	this._rendered = this.element;

	// Fixes CodeMirror bug (#344)
	const temp_cm = this.codemirror;
	setTimeout(function () {
		temp_cm.refresh();
	}.bind(temp_cm), 0);
};

LatexEditor.prototype.setPreviewMaxHeight = function () {
	const cm = this.codemirror;
	const wrapper = cm.getWrapperElement();
	const preview = wrapper.nextSibling;

	// Calc preview max height
	const paddingTop = parseInt(window.getComputedStyle(wrapper).paddingTop);
	const borderTopWidth = parseInt(window.getComputedStyle(wrapper).borderTopWidth);
	const optionsMaxHeight = parseInt(this.options.maxHeight);
	const wrapperMaxHeight = optionsMaxHeight + paddingTop * 2 + borderTopWidth * 2;
	preview.style.height = wrapperMaxHeight.toString() + 'px';
};

LatexEditor.prototype.createSideBySide = function () {
	const cm = this.codemirror;
	const wrapper = cm.getWrapperElement();
	let preview = wrapper.nextSibling;

	if (!preview || !/editor-preview-side/.test(preview.className)) {
		preview = document.createElement('div');
		preview.className = 'editor-preview-side';

		if (this.options.previewClass) {

			if (Array.isArray(this.options.previewClass)) {
				for (let i = 0; i < this.options.previewClass.length; i++) {
					preview.className += (' ' + this.options.previewClass[i]);
				}

			} else if (typeof this.options.previewClass === 'string') {
				preview.className += (' ' + this.options.previewClass);
			}
		}

		wrapper.parentNode.insertBefore(preview, wrapper.nextSibling);
	}

	if (typeof this.options.maxHeight !== 'undefined') {
		this.setPreviewMaxHeight();
	}

	let cScroll = false;
	let pScroll = false;
	cm.on('scroll', function (v) {
		if (cScroll) {
			cScroll = false;
			return;
		}
		pScroll = true;
		const height = v.getScrollInfo().height - v.getScrollInfo().clientHeight;
		const ratio = parseFloat(v.getScrollInfo().top) / height;
		preview.scrollTop = (preview.scrollHeight - preview.clientHeight) * ratio;
	});

	// Syncs scroll  preview -> editor
	preview.onscroll = function () {
		if (pScroll) {
			pScroll = false;
			return;
		}
		cScroll = true;
		const height = preview.scrollHeight - preview.clientHeight;
		const ratio = parseFloat(preview.scrollTop) / height;
		const move = (cm.getScrollInfo().height - cm.getScrollInfo().clientHeight) * ratio;
		cm.scrollTo(0, move);
	};
	return preview;
};

/**
 * Get or set the text content.
 */
LatexEditor.prototype.value = function (val) {
	const cm = this.codemirror;
	if (val === undefined) {
		return cm.getValue();
	} else {
		cm.getDoc().setValue(val);
		if (this.isPreviewActive()) {
			const wrapper = cm.getWrapperElement();
			const preview = wrapper.lastChild;
			preview.innerHTML = this.options.previewRender(val, preview);
		}
		return this;
	}
};


/**
 * Bind static methods for exports.
 */
LatexEditor.toggleSideBySide = toggleSideBySide;

LatexEditor.prototype.isPreviewActive = function () {
	const cm = this.codemirror;
	const wrapper = cm.getWrapperElement();
	const preview = wrapper.lastChild;

	return /editor-preview-active/.test(preview.className);
};

LatexEditor.prototype.toTextArea = function () {
	const cm = this.codemirror;
	const wrapper = cm.getWrapperElement();
	const easyMDEContainer = wrapper.parentNode;

	if (easyMDEContainer) {
		if (this.gui.sideBySide) {
			easyMDEContainer.removeChild(this.gui.sideBySide);
		}
	}

	easyMDEContainer.parentNode.insertBefore(wrapper, easyMDEContainer);
	easyMDEContainer.remove();

	cm.toTextArea();
};

function _toggleBlock(editor, type, start_chars) {
	if (/editor-preview-active/.test(editor.codemirror.getWrapperElement().lastChild.className))
		return;

	const cm = editor.codemirror;

	let text;
	let start = start_chars;

	const startPoint = cm.getCursor('start');
	const endPoint = cm.getCursor('end');

	text = cm.getSelection();
	cm.replaceSelection(start + text);

	startPoint.ch += start_chars.length;
	endPoint.ch = startPoint.ch + text.length;

	cm.setSelection(startPoint, endPoint);
	cm.focus();
}

function appendCode(code=false) {
	if (code === false) return;
	let cm = editor.codemirror;
	// _replaceSelection(cm, code);
	_toggleBlock(editor, 'bold', code)
}