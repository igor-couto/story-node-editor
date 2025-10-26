(function(joint, V) {
    var graph = new joint.dia.Graph({}, {
        cellNamespace: joint.shapes
    });
    var paper = new joint.dia.Paper({
        el: document.getElementById('paper'),
        width: '100%',
        height: '100%',
        model: graph,
        cellViewNamespace: joint.shapes,
        async: true,
        frozen: true,
        gridSize: 5,
        drawGrid: {
            name: 'doubleMesh',
            args: [{
                    color: '#dadada',
                    thickness: 1
                },
                {
                    color: '#d4d4d4',
                    scaleFactor: 5,
                    thickness: 2
                }
            ]
        },
        linkPinning: false,
        snapLinks: true,
        sorting: joint.dia.Paper.sorting.NONE,
        defaultBlankAction: 'pan',
        defaultConnector: {
            name: 'rounded'
        },
        defaultRouter: {
            name: 'metro'
        },
        defaultLink: new joint.shapes.standard.Link({
            connector: {
                name: 'jumpover',
                args: {
                    jump: 'arc',
                    size: 10
                }
            }
        }),
        markAvailable: true,
        interactive: {
            linkMove: false,
            elementMove: true
        },
        validateConnection: function(cellViewSource, magnetSource, cellViewTarget, magnetTarget, end, linkView) {
            console.log('validateConnection called');

            if (!magnetTarget) {
                console.log('No magnetTarget');
                return false;
            }

            if (!magnetSource) {
                console.log('No magnetSource');
                return false;
            }

            if (cellViewSource === cellViewTarget) {
                console.log('Self-linking not allowed');
                return false;
            }

            var targetPortGroup = magnetTarget.getAttribute('port-group');
            if (targetPortGroup !== 'in') {
                console.log('Target port is not an "in" port:', targetPortGroup);
                return false;
            }

            var sourcePortGroup = magnetSource.getAttribute('port-group');
            var sourcePortId = magnetSource.getAttribute('port');
            console.log('Source port group:', sourcePortGroup);
            console.log('Source port ID:', sourcePortId);

            if (sourcePortGroup === 'out' || sourcePortGroup === 'choiceOut') {
                var links = graph.getConnectedLinks(cellViewSource.model, {
                    outbound: true
                });

                var outgoingLinksFromPort = links.filter(function(link) {
                    var source = link.get('source');
                    // Exclude the link being created
                    return source.port === sourcePortId && link !== linkView.model;
                });

                console.log('Outgoing links from port (excluding current link):', outgoingLinksFromPort.length);

                if (outgoingLinksFromPort.length >= 1) {
                    console.log('Port already has an outgoing link');
                    return false;
                }
            }

            console.log('Connection allowed');
            return true;
        }
    });

    // Container for all HTML views inside paper
    var htmlContainer = document.createElement('div');
    htmlContainer.style.pointerEvents = 'none';
    htmlContainer.style.position = 'absolute';
    htmlContainer.style.inset = '0';
    paper.el.appendChild(htmlContainer);
    paper.htmlContainer = htmlContainer;

    var turndownService = window.TurndownService ? new window.TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    }) : null;

    if (turndownService) {
        turndownService.keep(['u']);
        turndownService.addRule('strike', {
            filter: ['del', 's', 'strike'],
            replacement: function(content) {
                return '~~' + content + '~~';
            }
        });
    }

    function sanitizeHtmlContent(inputHtml) {
        var temp = document.createElement('div');
        temp.innerHTML = inputHtml;

        Array.prototype.slice.call(temp.getElementsByTagName('script')).forEach(function(node) {
            if (node.parentNode)
                node.parentNode.removeChild(node);
        });

        Array.prototype.slice.call(temp.getElementsByTagName('*')).forEach(function(node) {
            Array.prototype.slice.call(node.attributes).forEach(function(attr) {
                if (attr.name && attr.name.toLowerCase().indexOf('on') === 0)
                    node.removeAttribute(attr.name);
            });
        });

        return temp.innerHTML;
    }

    function convertMarkdownToHtml(markdownText) {
        if (!markdownText)
            return '';
        if (window.marked && typeof window.marked.parse === 'function') {
            var rendered = window.marked.parse(markdownText);
            return sanitizeHtmlContent(rendered);
        }
        var fallback = document.createElement('div');
        fallback.textContent = markdownText;
        return fallback.innerHTML.replace(/\n/g, '<br>');
    }

    function convertHtmlToMarkdown(htmlText) {
        if (!htmlText)
            return '';
        if (turndownService)
            return turndownService.turndown(htmlText);
        return htmlText;
    }

    window.storyNodeEditor = window.storyNodeEditor || {};
    window.storyNodeEditor.renderMarkdown = function(markdownText) {
        return convertMarkdownToHtml(markdownText || '');
    };

    var imageLibrary = Array.isArray(window.storyNodeEditor.imageLibrary) ? window.storyNodeEditor.imageLibrary : [];
    window.storyNodeEditor.imageLibrary = imageLibrary;
    var imagesModal = null;

    function ensureImagesModal() {
        if (!imagesModal)
            imagesModal = createImagesModal();
        return imagesModal;
    }

    window.storyNodeEditor.registerImage = function(imageInfo) {
        if (!imageInfo || typeof imageInfo.dataUrl !== 'string')
            return null;

        var maxBytes = 20 * 1024 * 1024; // 20 MB
        if (typeof imageInfo.size === 'number' && imageInfo.size > maxBytes) {
            console.warn('Skipping image registration because it exceeds the 20 MB limit.');
            return null;
        }

        var dataUrl = imageInfo.dataUrl;
        if (!dataUrl)
            return null;

        var existing = imageLibrary.find(function(entry) {
            return entry.dataUrl === dataUrl;
        });
        if (existing)
            return existing;

        var entry = {
            id: 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
            dataUrl: dataUrl,
            name: (typeof imageInfo.name === 'string' && imageInfo.name.trim()) ? imageInfo.name.trim() : 'Image ' + (imageLibrary.length + 1),
            size: typeof imageInfo.size === 'number' ? imageInfo.size : 0,
            addedAt: typeof imageInfo.addedAt === 'number' ? imageInfo.addedAt : Date.now()
        };

        imageLibrary.push(entry);

        if (imagesModal && typeof imagesModal.refresh === 'function')
            imagesModal.refresh();
        if (typeof window.storyNodeEditor.notifyImageUsageChange === 'function')
            window.storyNodeEditor.notifyImageUsageChange();

        return entry;
    };

    window.storyNodeEditor.openImageLibrary = function(options) {
        ensureImagesModal().open(options || {});
    };
    window.storyNodeEditor.notifyImageUsageChange = function() {
        if (imagesModal && imagesModal.isOpen())
            imagesModal.refresh();
    };

    var richTextEditor = createRichTextEditor();
    var codeViewer = createCodeViewer();
    var helpModal = createHelpModal();

    window.storyNodeEditor.openTextEditor = function(options) {
        richTextEditor.open(options || {});
    };
    window.storyNodeEditor.openCodeViewer = function(options) {
        codeViewer.open(options || {});
    };
    window.storyNodeEditor.openHelp = function(options) {
        helpModal.open(options || {});
    };

    const magnetAvailabilityHighlighter = {
        name: 'stroke',
        options: {
            padding: 6,
            attrs: {
                'stroke-width': 3,
                'stroke': '#f0f78b',
            }
        }
    };
    paper.options.highlighting.magnetAvailability = magnetAvailabilityHighlighter;

    // Hover on link (edge). Should show the close icon
    paper.on('link:mouseenter', function(linkView) {
        const tools = new joint.dia.ToolsView({
            tools: [
                new joint.linkTools.TargetArrowhead(),
                new joint.linkTools.Remove({
                    distance: '50%',
                    scale: 2
                })
            ]
        });
        linkView.addTools(tools);
    });
    // Remove the hover logic added above
    paper.on('link:mouseleave', function(linkView) {
        linkView.removeTools();
    });

    // This happens during zoom
    paper.on('transform', function() {
        // Update the transformation of all JointJS HTML Elements
        let htmlContainer = this.htmlContainer;
        htmlContainer.style.transformOrigin = '0 0';
        htmlContainer.style.transform = V.matrixToTransformString(this.matrix());
    });

    // TODO: Logic to remove ports
    graph.on('remove', function(cell, collection, opt) {
        if (!cell.isLink() || !opt.ui) return;
        const target = this.getCell(cell.target().id);
        if (target instanceof joint.shapes.html.Element)
            target.updateInPorts();
    });

    // *************** PAN ***************
    let isPanning = false;
    let panStartPoint = {
        x: 0,
        y: 0
    };
    let panStartTranslate = {
        x: 0,
        y: 0
    };

    function startPanning(evt) {
        if (evt.button === 1) { // Middle mouse button
            document.body.style.cursor = `grabbing`;
            isPanning = true;
            panStartPoint = {
                x: evt.clientX,
                y: evt.clientY
            };
            panStartTranslate = paper.translate();
            evt.preventDefault(); // Prevent default scrolling behavior
        }
    }

    paper.on('blank:pointerdown', function(evt) {
        startPanning(evt);
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
    });

    paper.on('cell:pointerdown', function(cellView, evt) {
        startPanning(evt);
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
    });

    function doPanning(evt) {
        if (isPanning) {
            let dx = evt.clientX - panStartPoint.x;
            let dy = evt.clientY - panStartPoint.y;
            paper.translate(panStartTranslate.tx + dx, panStartTranslate.ty + dy);
        }
    }

    paper.on('cell:pointermove blank:pointermove', function(evt) {
        doPanning(evt);
    });

    function stopPanning(evt) {
        if (isPanning)
            isPanning = false;
        document.body.style.cursor = `url('assets/default.png'), default`;
    }

    paper.on('cell:pointerup blank:pointerup', function(evt) {
        stopPanning(evt);
    });
    // *************** END-PAN ***************

    // *************** Shortcuts ***************
    function isInputFocused(evt) {
        var target = evt.target;
        return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    }

    document.addEventListener('keydown', function(evt) {
        if (!isInputFocused(evt)) {

            if (evt.key === 'c' || evt.key === 'C') {
                paper.translate(0, 0);
                paper.scale(1);
                zoomLevel = 1;
            }

            if (evt.key === 'f' || evt.key === 'F') {
                fitPaperToContent();
            }

            if (evt.key === 'n' || evt.key === 'N') {
                createNewNode();
            }

            if (evt.key === '+') {
                var currentScale = paper.scale().sx;
                paper.scale(currentScale + 0.1);
            }

            if (evt.key === '-') {
                var currentScale = paper.scale().sx;
                paper.scale(currentScale - 0.1);
            }
        }
    });
    // *************** END-Shortcuts ***************

    paper.unfreeze();

    // *************** TOOLBAR ***************
    let zoomLevel = 1;

    function fitPaperToContent() {
        paper.scaleContentToFit();
        zoomLevel = paper.scale().sx;
    }

    let center = paper.getArea().center();

    document.getElementById('zoom-in').addEventListener('click', function() {
        zoomLevel = Math.min(3, zoomLevel + 0.2);
        paper.scaleUniformAtPoint(zoomLevel, center);
    }, {
        passive: true
    });

    document.getElementById('zoom-out').addEventListener('click', function() {
        zoomLevel = Math.max(0.2, zoomLevel - 0.2);
        paper.scaleUniformAtPoint(zoomLevel, center);
    }, {
        passive: true
    });

    document.getElementById('view').addEventListener('click', function() {
        fitPaperToContent();
    }, {
        passive: true
    });

    document.getElementById('code').addEventListener('click', function() {
        const payload = collectDiagramData();
        codeViewer.open({
            title: 'Diagram JSON',
            data: payload
        });
    }, {
        passive: true
    });

    document.getElementById('help').addEventListener('click', function() {
        helpModal.open();
    }, {
        passive: true
    });

    var imagesButton = document.getElementById('images');
    if (imagesButton) {
        imagesButton.addEventListener('click', function() {
            if (window.storyNodeEditor && typeof window.storyNodeEditor.openImageLibrary === 'function')
                window.storyNodeEditor.openImageLibrary();
        }, {
            passive: true
        });
    }

    document.getElementById('new-node').addEventListener('click', function() {
        createNewNode();
    }, {
        passive: true
    });

    (function() {
        var saveButton = document.getElementById('save');
        if (!saveButton)
            return;
        saveButton.addEventListener('click', function() {
            const payload = collectDiagramData();

            const apiUrl = 'https://localhost/api';

            console.log(JSON.stringify(payload));

            // Send the PUT request
            fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                .then(response => {
                    if (response.ok) {
                        alert('Diagram saved successfully!');
                    } else {
                        alert('Failed to save diagram.');
                        console.error('Save failed:', response.statusText);
                    }
                })
                .catch(error => {
                    alert('An error occurred while saving the diagram.');
                    console.error('Save error:', error);
                });
        }, {
            passive: true
        });
    })();
    // *************** END-TOOLBAR ***************

    // *************** MOUSE WHEEL ZOOM ***************
    window.addEventListener('wheel', function(event) {
        if (!paper || !paper.el)
            return;

        if (!paper.el.contains(event.target))
            return;

        event.preventDefault();

        const cursorX = event.clientX;
        const cursorY = event.clientY;

        const localPoint = paper.clientToLocalPoint(cursorX, cursorY);

        // Determine the scroll direction
        let delta = event.deltaY || event.wheelDelta;
        let zoomFactor;

        if (delta < 0) {
            // Scrolling up, zoom in
            zoomFactor = 1.1;
        } else {
            // Scrolling down, zoom out
            zoomFactor = 0.9;
        }
        // Calculate the new zoom level
        zoomLevel *= zoomFactor;
        zoomLevel = Math.min(Math.max(zoomLevel, 0.2), 3); // Clamp between 0.2 and 3

        // Apply the zoom transformation at the local point
        paper.scaleUniformAtPoint(zoomLevel, localPoint);
    }, {
        passive: false,
        capture: true
    });
    // *************** END-MOUSE WHEEL ZOOM ***************

    function createRichTextEditor() {
        var overlay = document.createElement('div');
        overlay.className = 'richtext-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = [
            '<div class="richtext-modal" role="dialog" aria-modal="true" aria-label="Edit node">',
            '    <div class="richtext-title-row">',
            '        <label class="richtext-title-label" for="richtext-title-input">Title</label>',
            '        <input type="text" id="richtext-title-input" class="richtext-title-input" placeholder="Optional title" maxlength="120" />',
            '    </div>',
            '    <div class="richtext-toolbar">',
            '        <div class="richtext-toolbar-group">',
            '            <button type="button" class="richtext-button" data-command="bold" aria-label="Bold">',
            '                <span aria-hidden="true">B</span>',
            '            </button>',
            '            <button type="button" class="richtext-button" data-command="italic" aria-label="Italic">',
            '                <span aria-hidden="true">I</span>',
            '            </button>',
            '            <button type="button" class="richtext-button" data-command="underline" aria-label="Underline">',
            '                <span aria-hidden="true">U</span>',
            '            </button>',
            '            <button type="button" class="richtext-button" data-command="strikeThrough" aria-label="Strikethrough">',
            '                <span aria-hidden="true">S</span>',
            '            </button>',
            '        </div>',
            '        <div class="richtext-toolbar-group">',
            '            <button type="button" class="richtext-button richtext-toggle" data-mode="markdown" aria-label="Switch to markdown view" aria-pressed="false">',
            '                <span aria-hidden="true">MD</span>',
            '            </button>',
            '            <button type="button" class="richtext-close" aria-label="Close editor">',
            '                <span aria-hidden="true">&times;</span>',
            '            </button>',
            '        </div>',
            '    </div>',
            '    <div class="richtext-editor-wrapper">',
            '        <div class="richtext-editor-area" contenteditable="true" spellcheck="true"></div>',
            '        <textarea class="richtext-markdown-area" spellcheck="false"></textarea>',
            '    </div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        var modal = overlay.querySelector('.richtext-modal');
        var editorArea = overlay.querySelector('.richtext-editor-area');
        var markdownArea = overlay.querySelector('.richtext-markdown-area');
        var titleInput = overlay.querySelector('.richtext-title-input');
        var closeButton = overlay.querySelector('.richtext-close');
        var toggleButton = overlay.querySelector('.richtext-toggle');
        var commandButtons = overlay.querySelectorAll('.richtext-button[data-command]');
        var buttonByCommand = {};
        Array.prototype.forEach.call(commandButtons, function(button) {
            var command = button.getAttribute('data-command');
            if (command)
                buttonByCommand[command] = button;
        });

        var isOpen = false;
        var pendingSave = null;
        var storedSelection = null;
        var isMarkdownMode = false;
        var lastSavedContent = null;
        var lastSavedTitle = null;

        function open(options) {
            options = options || {};
            pendingSave = typeof options.onSave === 'function' ? options.onSave : null;
            var initialMarkdown = '';
            if (typeof options.initialContent === 'string')
                initialMarkdown = options.initialContent;
            else if (typeof options.initialValue === 'string')
                initialMarkdown = options.initialValue;
            initialMarkdown = normalizeLineEndings(initialMarkdown);
            var initialTitle = '';
            if (typeof options.initialTitle === 'string')
                initialTitle = options.initialTitle;
            else if (typeof options.title === 'string')
                initialTitle = options.title;
            if (titleInput)
                titleInput.value = initialTitle;
            overlay.classList.add('is-visible');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('richtext-open');
            markdownArea.value = initialMarkdown;
            setRichTextContentFromMarkdown(initialMarkdown);
            isOpen = true;
            storedSelection = null;
            lastSavedContent = initialMarkdown;
            lastSavedTitle = (initialTitle || '').trim();
            setMarkdownMode(false, true);
            var scheduleFocus = window.requestAnimationFrame || function(fn) {
                return setTimeout(fn, 16);
            };
            scheduleFocus(function() {
                moveCaretToEnd();
                updateToolbarStates();
            });
            document.addEventListener('keydown', handleKeydown, true);
            document.addEventListener('selectionchange', handleSelectionChange, true);
        }

        function close() {
            if (!isOpen)
                return;
            commitChanges();
            overlay.classList.remove('is-visible');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('richtext-open');
            editorArea.innerHTML = '';
            markdownArea.value = '';
            if (titleInput)
                titleInput.value = '';
            isOpen = false;
            pendingSave = null;
            storedSelection = null;
            lastSavedContent = null;
            lastSavedTitle = null;
            setMarkdownMode(false, true);
            document.removeEventListener('keydown', handleKeydown, true);
            document.removeEventListener('selectionchange', handleSelectionChange, true);
        }

        function normalizeLineEndings(text) {
            if (!text)
                return '';
            return text.replace(/\r\n/g, '\n');
        }

        function focusEditor() {
            var target = isMarkdownMode ? markdownArea : editorArea;
            try {
                target.focus({ preventScroll: true });
            } catch (err) {
                target.focus();
            }
        }

        function moveCaretToEnd() {
            focusEditor();
            if (isMarkdownMode) {
                var valueLength = markdownArea.value.length;
                markdownArea.setSelectionRange(valueLength, valueLength);
            } else {
                placeCaretAtEnd(editorArea);
                saveSelection();
            }
        }

        function setRichTextContentFromMarkdown(markdownValue) {
            editorArea.innerHTML = convertMarkdownToHtml(markdownValue || '');
        }

        function readMarkdownFromRichText() {
            var sanitized = sanitizeHtmlContent(editorArea.innerHTML);
            var temp = document.createElement('div');
            temp.innerHTML = sanitized;
            var textContent = temp.textContent.replace(/\u200B/g, '').trim();
            if (!textContent)
                return '';
            return convertHtmlToMarkdown(sanitized);
        }

        function readEditorContent() {
            if (isMarkdownMode) {
                var rawMarkdown = normalizeLineEndings(markdownArea.value || '');
                var trimmedText = rawMarkdown.replace(/\u200B/g, '').trim();
                return trimmedText ? rawMarkdown : '';
            }
            return readMarkdownFromRichText();
        }

        function commitChanges() {
            if (!pendingSave)
                return;
            var content = readEditorContent();
            if (content && content !== '')
                content = normalizeLineEndings(content);
            else
                content = '';
            var title = '';
            if (titleInput)
                title = titleInput.value || '';
            title = title.trim();
            if (content === lastSavedContent && title === lastSavedTitle)
                return;
            lastSavedContent = content;
            lastSavedTitle = title;
            pendingSave({
                content: content,
                title: title
            });
        }

        function handleKeydown(evt) {
            if (!isOpen)
                return;
            if (evt.key === 'Escape') {
                evt.preventDefault();
                close();
            }
        }

        function placeCaretAtEnd(element) {
            var range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(false);
            var selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }

        function saveSelection() {
            if (isMarkdownMode) {
                storedSelection = null;
                return;
            }
            var selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                storedSelection = null;
                return;
            }
            var range = selection.getRangeAt(0);
            if (editorArea.contains(range.commonAncestorContainer))
                storedSelection = range.cloneRange();
            else
                storedSelection = null;
        }

        function restoreSelection() {
            if (isMarkdownMode || !storedSelection)
                return;
            var selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(storedSelection);
        }

        function updateToolbarStates() {
            if (!isOpen || isMarkdownMode) {
                Object.keys(buttonByCommand).forEach(function(command) {
                    setButtonState(command, false);
                });
                return;
            }
            var selection = window.getSelection();
            var withinEditor = selection && selection.rangeCount && editorArea.contains(selection.anchorNode);
            setButtonState('bold', withinEditor && document.queryCommandState && document.queryCommandState('bold'));
            setButtonState('italic', withinEditor && document.queryCommandState && document.queryCommandState('italic'));
            setButtonState('underline', withinEditor && document.queryCommandState && document.queryCommandState('underline'));
            setButtonState('strikeThrough', withinEditor && document.queryCommandState && document.queryCommandState('strikeThrough'));
        }

        function setButtonState(command, isActive) {
            var button = buttonByCommand[command];
            if (!button)
                return;
            if (isActive)
                button.classList.add('is-active');
            else
                button.classList.remove('is-active');
        }

        function handleSelectionChange() {
            if (!isOpen)
                return;
            saveSelection();
            updateToolbarStates();
        }

        function trackSelection() {
            if (!isOpen || isMarkdownMode)
                return;
            saveSelection();
            updateToolbarStates();
        }

        function insertText(text) {
            if (isMarkdownMode)
                return;
            if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
                if (document.execCommand('insertText', false, text))
                    return;
            }
            var selection = window.getSelection();
            if (!selection || selection.rangeCount === 0)
                return;
            var range = selection.getRangeAt(0);
            range.deleteContents();
            var textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        function applyModeState() {
            modal.classList.toggle('is-markdown-mode', isMarkdownMode);
            if (toggleButton) {
                toggleButton.setAttribute('aria-pressed', isMarkdownMode ? 'true' : 'false');
                toggleButton.setAttribute('data-mode', isMarkdownMode ? 'richtext' : 'markdown');
                toggleButton.setAttribute('aria-label', isMarkdownMode ? 'Switch to rich text view' : 'Switch to markdown view');
                toggleButton.title = isMarkdownMode ? 'Switch to rich text view' : 'Switch to markdown view';
                var label = toggleButton.querySelector('span');
                if (label)
                    label.textContent = isMarkdownMode ? 'Aa' : 'MD';
            }
            Array.prototype.forEach.call(commandButtons, function(button) {
                button.disabled = isMarkdownMode;
            });
        }

        function setMarkdownMode(nextMode, suppressContentSync) {
            if (nextMode === isMarkdownMode) {
                applyModeState();
                return;
            }
            if (!nextMode && !suppressContentSync)
                setRichTextContentFromMarkdown(markdownArea.value || '');
            if (nextMode) {
                storedSelection = null;
            }
            isMarkdownMode = nextMode;
            applyModeState();
            if (!isMarkdownMode)
                updateToolbarStates();
        }

        function toggleEditorMode() {
            if (isMarkdownMode) {
                setMarkdownMode(false);
            } else {
                var markdownFromRichText = readMarkdownFromRichText();
                markdownArea.value = normalizeLineEndings(markdownFromRichText);
                setMarkdownMode(true, true);
            }
            moveCaretToEnd();
            commitChanges();
        }

        Array.prototype.forEach.call(commandButtons, function(button) {
            var command = button.getAttribute('data-command');
            button.addEventListener('mousedown', function(evt) {
                evt.preventDefault();
            });
            button.addEventListener('click', function(evt) {
                evt.preventDefault();
                if (isMarkdownMode)
                    return;
                focusEditor();
                restoreSelection();
                document.execCommand(command, false, null);
                trackSelection();
                commitChanges();
            });
        });

        editorArea.addEventListener('keydown', function(evt) {
            if (!isOpen || isMarkdownMode)
                return;
            if (evt.key === 'Tab') {
                evt.preventDefault();
                restoreSelection();
                insertText('    ');
                trackSelection();
                commitChanges();
            }
        });

        editorArea.addEventListener('input', function() {
            if (!isOpen || isMarkdownMode)
                return;
            commitChanges();
            trackSelection();
        });

        editorArea.addEventListener('focus', trackSelection);
        editorArea.addEventListener('keyup', trackSelection);
        editorArea.addEventListener('mouseup', trackSelection);

        editorArea.addEventListener('blur', function() {
            if (!isOpen || isMarkdownMode)
                return;
            saveSelection();
            updateToolbarStates();
            commitChanges();
        });

        markdownArea.addEventListener('input', function() {
            if (!isOpen || !isMarkdownMode)
                return;
            commitChanges();
        });

        markdownArea.addEventListener('keydown', function(evt) {
            if (!isOpen || !isMarkdownMode)
                return;
            if (evt.key === 'Tab') {
                evt.preventDefault();
                var start = markdownArea.selectionStart;
                var end = markdownArea.selectionEnd;
                var value = markdownArea.value;
                markdownArea.value = value.substring(0, start) + '    ' + value.substring(end);
                markdownArea.selectionStart = markdownArea.selectionEnd = start + 4;
                commitChanges();
            }
        });

        markdownArea.addEventListener('blur', function() {
            if (!isOpen || !isMarkdownMode)
                return;
            commitChanges();
        });

        if (toggleButton) {
            toggleButton.addEventListener('mousedown', function(evt) {
                evt.preventDefault();
            });
            toggleButton.addEventListener('click', function(evt) {
                evt.preventDefault();
                toggleEditorMode();
            });
        }

        if (closeButton) {
            closeButton.addEventListener('click', function(evt) {
                evt.preventDefault();
                close();
            });
        }

        overlay.addEventListener('click', function(evt) {
            if (evt.target === overlay) {
                evt.preventDefault();
                close();
            }
        });

        return {
            open: function(options) {
                if (isOpen)
                    close();
                open(options || {});
            }
        };
    }

    function createCodeViewer() {
        var overlay = document.createElement('div');
        overlay.className = 'code-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = [
            '<div class="code-modal" role="dialog" aria-modal="true" aria-label="Diagram JSON view">',
            '    <div class="code-modal-header">',
            '        <span class="code-modal-title">Diagram JSON</span>',
            '        <button type="button" class="code-modal-close" aria-label="Close code view">',
            '            <span aria-hidden="true">&times;</span>',
            '        </button>',
            '    </div>',
            '    <div class="code-modal-body">',
            '        <pre class="code-modal-pre"><code class="code-modal-code"></code></pre>',
            '    </div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        var closeButton = overlay.querySelector('.code-modal-close');
        var titleElement = overlay.querySelector('.code-modal-title');
        var codeElement = overlay.querySelector('.code-modal-code');

        var isOpen = false;

        function setContent(text) {
            if (codeElement)
                codeElement.textContent = text || '';
        }

        function open(options) {
            options = options || {};
            var title = typeof options.title === 'string' && options.title.trim() ? options.title.trim() : 'Diagram JSON';
            var text = '';
            if (typeof options.jsonText === 'string')
                text = options.jsonText;
            else if (options.data !== undefined) {
                try {
                    text = JSON.stringify(options.data, null, 2);
                } catch (error) {
                    text = 'Unable to serialize data: ' + error.message;
                }
            }

            if (titleElement)
                titleElement.textContent = title;
            setContent(text);

            overlay.classList.add('is-visible');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('code-view-open');
            isOpen = true;

            document.addEventListener('keydown', handleKeydown, true);

            if (closeButton) {
                try {
                    closeButton.focus({
                        preventScroll: true
                    });
                } catch (err) {
                    closeButton.focus();
                }
            }
        }

        function close() {
            if (!isOpen)
                return;

            document.removeEventListener('keydown', handleKeydown, true);

            overlay.classList.remove('is-visible');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('code-view-open');

            setContent('');
            isOpen = false;
        }

        function handleKeydown(evt) {
            if (!isOpen)
                return;
            if (evt.key === 'Escape') {
                evt.preventDefault();
                close();
            }
        }

        if (closeButton) {
            closeButton.addEventListener('click', function(evt) {
                evt.preventDefault();
                close();
            });
        }

        overlay.addEventListener('click', function(evt) {
            if (evt.target === overlay) {
                evt.preventDefault();
                close();
            }
        });

        return {
            open: function(options) {
                if (isOpen)
                    close();
                open(options || {});
            },
            close: close
        };
    }

    function createHelpModal() {
        var overlay = document.createElement('div');
        overlay.className = 'help-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = [
            '<div class="help-modal" role="dialog" aria-modal="true" aria-label="Editor help and shortcuts">',
            '    <div class="help-modal-header">',
            '        <span class="help-modal-title">Story Node Editor Help</span>',
            '        <button type="button" class="help-modal-close" aria-label="Close help window">',
            '            <span aria-hidden="true">&times;</span>',
            '        </button>',
            '    </div>',
            '    <div class="help-modal-body">',
            '        <p class="help-modal-note" hidden></p>',
            '        <section class="help-section">',
            '            <h2 class="help-section-title">Keyboard Shortcuts</h2>',
            '            <ul class="help-shortcuts-list">',
            '                <li><span class="help-kbd">F</span><span class="help-shortcut-desc">Fit the entire diagram inside the viewport.</span></li>',
            '                <li><span class="help-kbd">C</span><span class="help-shortcut-desc">Reset zoom and pan to the default position.</span></li>',
            '                <li><span class="help-kbd">N</span><span class="help-shortcut-desc">Create a new empty node centered on the canvas.</span></li>',
            '                <li><span class="help-kbd">+</span>/<span class="help-kbd">-</span><span class="help-shortcut-desc">Incrementally zoom in or out.</span></li>',
            '                <li><span class="help-kbd">Ctrl / Middle Button + Drag</span><span class="help-shortcut-desc">Pan around the canvas.</span></li>',
            '            </ul>',
            '        </section>',
            '        <section class="help-section">',
            '            <h2 class="help-section-title">Working with Nodes</h2>',
            '            <ul class="help-info-list">',
            '                <li>Select a node and click its title or content area to edit details.</li>',
            '                <li>Use the “Choices” area to add branching options; each choice creates its own link port.</li>',
            '                <li>Drag from an output port to connect to another node’s top port.</li>',
            '                <li>Delete a node with the trash icon in the top-right corner.</li>',
            '            </ul>',
            '        </section>',
            '        <section class="help-section">',
            '            <h2 class="help-section-title">Exporting</h2>',
            '            <ul class="help-info-list">',
            '                <li>Use the “Code” button to view the JSON representation of your story graph.</li>',
            '                <li>The “Publish” button will send publish the story in the website.</li>',
            '            </ul>',
            '        </section>',
            '    </div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        var closeButton = overlay.querySelector('.help-modal-close');
        var titleElement = overlay.querySelector('.help-modal-title');
        var noteElement = overlay.querySelector('.help-modal-note');

        var isOpen = false;

        function applyNote(note) {
            if (!noteElement)
                return;
            if (typeof note === 'string' && note.trim()) {
                noteElement.textContent = note.trim();
                noteElement.hidden = false;
            } else {
                noteElement.textContent = '';
                noteElement.hidden = true;
            }
        }

        function open(options) {
            options = options || {};
            var title = typeof options.title === 'string' && options.title.trim() ? options.title.trim() : 'Story Node Editor Help';
            if (titleElement)
                titleElement.textContent = title;
            applyNote(options.note);

            overlay.classList.add('is-visible');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('help-view-open');
            isOpen = true;

            document.addEventListener('keydown', handleKeydown, true);

            if (closeButton) {
                try {
                    closeButton.focus({
                        preventScroll: true
                    });
                } catch (err) {
                    closeButton.focus();
                }
            }
        }

        function close() {
            if (!isOpen)
                return;

            document.removeEventListener('keydown', handleKeydown, true);

            overlay.classList.remove('is-visible');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('help-view-open');
            applyNote('');

            isOpen = false;
        }

        function handleKeydown(evt) {
            if (!isOpen)
                return;
            if (evt.key === 'Escape') {
                evt.preventDefault();
                close();
            }
        }

        if (closeButton) {
            closeButton.addEventListener('click', function(evt) {
                evt.preventDefault();
                close();
            });
        }

        overlay.addEventListener('click', function(evt) {
            if (evt.target === overlay) {
                evt.preventDefault();
                close();
            }
        });

        return {
            open: function(options) {
                if (isOpen)
                    close();
                open(options || {});
            },
            close: close
        };
    }

    function createImagesModal() {
        var overlay = document.createElement('div');
        overlay.className = 'images-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = [
            '<div class="images-modal" role="dialog" aria-modal="true" aria-label="Uploaded images this session">',
            '    <div class="images-modal-header">',
            '        <h2 class="images-modal-title">Uploaded Images</h2>',
            '        <button type="button" class="images-modal-close" aria-label="Close image library">&times;</button>',
            '    </div>',
            '    <div class="images-modal-body">',
            '        <div class="images-modal-actions">',
            '            <button type="button" class="images-modal-upload">Upload image</button>',
            '            <button type="button" class="images-modal-delete" disabled>Delete image</button>',
            '            <span class="images-modal-hint">PNG, JPG, or GIF • Max 20 MB</span>',
            '            <input type="file" class="images-modal-file" accept="image/*" hidden />',
            '        </div>',
            '        <p class="images-modal-empty">No images uploaded yet this session.</p>',
            '        <div class="images-grid" role="list"></div>',
            '    </div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        var modal = overlay.querySelector('.images-modal');
        var closeButton = overlay.querySelector('.images-modal-close');
        var grid = overlay.querySelector('.images-grid');
        var emptyMessage = overlay.querySelector('.images-modal-empty');
        var uploadButton = overlay.querySelector('.images-modal-upload');
        var uploadInput = overlay.querySelector('.images-modal-file');
        var deleteButton = overlay.querySelector('.images-modal-delete');
        var titleElement = overlay.querySelector('.images-modal-title');
        var hintElement = overlay.querySelector('.images-modal-hint');
        var hintDefaultText = hintElement ? hintElement.textContent : '';
        var isOpen = false;
        var currentOptions = {};
        var isPickerMode = false;
        var deleteButtonDefaultLabel = deleteButton ? deleteButton.textContent : 'Delete image';
        var selectedEntryId = null;
        var allowDeleteMode = false;

        function formatFileSize(bytes) {
            if (!(bytes > 0))
                return '';
            var units = ['B', 'KB', 'MB', 'GB'];
            var power = Math.floor(Math.log(bytes) / Math.log(1024));
            power = Math.min(power, units.length - 1);
            var value = bytes / Math.pow(1024, power);
            var precision = value >= 10 || power === 0 ? 0 : 1;
            return value.toFixed(precision) + ' ' + units[power];
        }

        function formatTimestamp(timestamp) {
            if (!timestamp)
                return '';
            try {
                var date = new Date(timestamp);
                return date.toLocaleString();
            } catch (err) {
                return '';
            }
        }

        function getImageUsageCount(dataUrl) {
            if (!dataUrl || !graph)
                return 0;
            try {
                var cells = graph.getCells();
                var count = 0;
                cells.forEach(function(cell) {
                    if (cell && typeof cell.isElement === 'function' && cell.isElement()) {
                        var nodeImage = cell.prop(['fields', 'image']);
                        if (nodeImage && nodeImage === dataUrl)
                            count++;
                    }
                });
                return count;
            } catch (err) {
                console.warn('Unable to compute image usage count', err);
                return 0;
            }
        }

        function getEntryById(entryId) {
            if (!entryId)
                return null;
            return imageLibrary.find(function(entry) {
                return entry && entry.id === entryId;
            }) || null;
        }

        function updateSelectionStyles() {
            if (!grid)
                return;
            var cards = grid.querySelectorAll('.images-card');
            Array.prototype.forEach.call(cards, function(card) {
                var cardId = card.getAttribute('data-entry-id');
                if (!cardId || !selectedEntryId)
                    card.classList.remove('is-selected');
                else
                    card.classList.toggle('is-selected', cardId === selectedEntryId);
            });
        }

        function updateDeleteButton() {
            if (!deleteButton)
                return;
            if (!allowDeleteMode) {
                deleteButton.disabled = true;
                deleteButton.textContent = deleteButtonDefaultLabel;
                return;
            }
            var entry = getEntryById(selectedEntryId);
            if (!entry) {
                deleteButton.disabled = true;
                deleteButton.textContent = deleteButtonDefaultLabel;
                return;
            }
            var usage = getImageUsageCount(entry.dataUrl);
            if (usage > 0) {
                deleteButton.disabled = true;
                deleteButton.textContent = usage === 1 ? 'In use by 1 node' : 'In use by ' + usage + ' nodes';
            } else {
                deleteButton.disabled = false;
                deleteButton.textContent = deleteButtonDefaultLabel;
            }
        }

        function setSelectedEntry(entryId) {
            if (!allowDeleteMode)
                return;
            if (selectedEntryId === entryId)
                selectedEntryId = null;
            else
                selectedEntryId = entryId;
            updateSelectionStyles();
            updateDeleteButton();
        }

        function deleteSelectedEntry() {
            if (!allowDeleteMode)
                return;
            var entry = getEntryById(selectedEntryId);
            if (!entry)
                return;
            var usage = getImageUsageCount(entry.dataUrl);
            if (usage > 0) {
                updateDeleteButton();
                return;
            }
            var message = 'Delete "' + (entry.name || 'Image') + '"? This cannot be undone.';
            if (typeof window.confirm === 'function' && !window.confirm(message))
                return;
            var index = imageLibrary.findIndex(function(item) {
                return item && item.id === entry.id;
            });
            if (index >= 0)
                imageLibrary.splice(index, 1);
            selectedEntryId = null;
            if (hintElement)
                hintElement.textContent = hintDefaultText;
            renderImages();
        }

        function renderImages() {
            if (!grid || !emptyMessage)
                return;

            grid.innerHTML = '';

            var entries = Array.isArray(imageLibrary) ? imageLibrary.slice().reverse() : [];
            if (selectedEntryId && !entries.some(function(entry) {
                    return entry && entry.id === selectedEntryId;
                }))
                selectedEntryId = null;
            if (!entries.length) {
                selectedEntryId = null;
                emptyMessage.textContent = isPickerMode ? 'No images yet. Upload a new one to get started.' : 'No images uploaded yet this session.';
                emptyMessage.style.display = '';
                grid.classList.remove('is-visible');
                updateDeleteButton();
                return;
            }

            emptyMessage.style.display = 'none';
            grid.classList.add('is-visible');

            var fragment = document.createDocumentFragment();
            var enableSelection = isPickerMode || allowDeleteMode;
            entries.forEach(function(entry) {
                var card = document.createElement('div');
                card.className = 'images-card';
                card.setAttribute('role', 'listitem');
                card.tabIndex = 0;
                card.setAttribute('data-entry-id', entry.id);
                if (enableSelection)
                    card.classList.add('is-selectable');

                var thumb = document.createElement('div');
                thumb.className = 'images-thumb';

                var img = document.createElement('img');
                img.src = entry.dataUrl;
                img.alt = entry.name || 'Uploaded image';
                img.draggable = false;
                thumb.appendChild(img);
                card.appendChild(thumb);

                var meta = document.createElement('div');
                meta.className = 'images-meta';

                var metaName = document.createElement('div');
                metaName.className = 'images-meta-name';
                metaName.textContent = entry.name || 'Image';
                metaName.title = metaName.textContent;
                meta.appendChild(metaName);

                var detailsParts = [];
                var sizeText = formatFileSize(entry.size);
                if (sizeText)
                    detailsParts.push(sizeText);
                var timestampText = formatTimestamp(entry.addedAt);
                if (timestampText)
                    detailsParts.push(timestampText);
                var usageCount = getImageUsageCount(entry.dataUrl);
                if (usageCount > 0)
                    detailsParts.push(usageCount === 1 ? 'Used by 1 node' : 'Used by ' + usageCount + ' nodes');
                else
                    detailsParts.push('Not used yet');

                if (detailsParts.length) {
                    var metaDetails = document.createElement('div');
                    metaDetails.className = 'images-meta-details';
                    metaDetails.textContent = detailsParts.join(' • ');
                    meta.appendChild(metaDetails);
                }

                card.appendChild(meta);

                if (isPickerMode) {
                    card.addEventListener('click', function(evt) {
                        evt.preventDefault();
                        selectEntry(entry);
                    });
                    card.addEventListener('keydown', function(evt) {
                        if (evt.key === 'Enter' || evt.key === ' ') {
                            evt.preventDefault();
                            selectEntry(entry);
                        }
                    });
                } else if (allowDeleteMode) {
                    card.addEventListener('click', function(evt) {
                        evt.preventDefault();
                        setSelectedEntry(entry.id);
                    });
                    card.addEventListener('keydown', function(evt) {
                        if (evt.key === 'Enter' || evt.key === ' ') {
                            evt.preventDefault();
                            setSelectedEntry(entry.id);
                        }
                    });
                }

                if (selectedEntryId && entry.id === selectedEntryId)
                    card.classList.add('is-selected');

                fragment.appendChild(card);
            });

            grid.appendChild(fragment);
            updateSelectionStyles();
            updateDeleteButton();
        }

        function selectEntry(entry) {
            if (!isPickerMode)
                return;
            if (entry && currentOptions && typeof currentOptions.onSelect === 'function')
                currentOptions.onSelect(entry);
            closeModal();
        }

        function handleKeydown(evt) {
            if (!isOpen)
                return;
            if (evt.key === 'Escape') {
                evt.preventDefault();
                closeModal();
            }
        }

        function openModal() {
            if (isOpen) {
                renderImages();
                return;
            }
            isOpen = true;
            overlay.classList.add('is-visible');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('images-modal-open');
            renderImages();
            document.addEventListener('keydown', handleKeydown, true);
            if (closeButton) {
                try {
                    closeButton.focus({
                        preventScroll: true
                    });
                } catch (err) {
                    closeButton.focus();
                }
            }
        }

        function closeModal() {
            if (!isOpen)
                return;
            isOpen = false;
            document.removeEventListener('keydown', handleKeydown, true);
            overlay.classList.remove('is-visible');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('images-modal-open');
            currentOptions = {};
            isPickerMode = false;
            allowDeleteMode = false;
            selectedEntryId = null;
            if (uploadInput)
                uploadInput.value = '';
            if (deleteButton) {
                deleteButton.disabled = true;
                deleteButton.textContent = deleteButtonDefaultLabel;
            }
        }

        function openModal(options) {
            options = options || {};
            currentOptions = options;
            isPickerMode = typeof options.onSelect === 'function';
            allowDeleteMode = !isPickerMode && options.allowDelete !== false && !!deleteButton;
            selectedEntryId = null;

            if (hintElement)
                hintElement.textContent = hintDefaultText;

            if (titleElement) {
                var providedTitle = typeof options.title === 'string' && options.title.trim() ? options.title.trim() : null;
                titleElement.textContent = providedTitle || (isPickerMode ? 'Select Image' : 'Uploaded Images');
            }

            if (hintElement)
                hintElement.style.display = (options.allowUpload === false) ? 'none' : '';

            if (uploadButton) {
                var allowUpload = options.allowUpload !== false;
                uploadButton.style.display = allowUpload ? 'inline-flex' : 'none';
                uploadButton.disabled = !allowUpload;
            }

            if (uploadInput)
                uploadInput.disabled = options.allowUpload === false;

            if (deleteButton) {
                deleteButton.style.display = allowDeleteMode ? 'inline-flex' : 'none';
                deleteButton.disabled = true;
                deleteButton.textContent = deleteButtonDefaultLabel;
            }

            if (isOpen) {
                renderImages();
                return;
            }
            isOpen = true;
            overlay.classList.add('is-visible');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('images-modal-open');
            renderImages();
            document.addEventListener('keydown', handleKeydown, true);
            if (closeButton) {
                try {
                    closeButton.focus({
                        preventScroll: true
                    });
                } catch (err) {
                    closeButton.focus();
                }
            }
        }

        if (closeButton) {
            closeButton.addEventListener('click', function(evt) {
                evt.preventDefault();
                closeModal();
            });
        }

        overlay.addEventListener('click', function(evt) {
            if (evt.target === overlay) {
                evt.preventDefault();
                closeModal();
            }
        });

        if (modal) {
            modal.addEventListener('click', function(evt) {
                evt.stopPropagation();
            });
        }

        if (uploadButton && uploadInput) {
            uploadButton.addEventListener('click', function(evt) {
                evt.preventDefault();
                if (uploadButton.disabled || uploadInput.disabled)
                    return;
                uploadInput.value = '';
                uploadInput.click();
            });

            uploadInput.addEventListener('change', function(evt) {
                var file = evt.target && evt.target.files ? evt.target.files[0] : null;
                if (!file)
                    return;
                if (file.type && file.type.indexOf('image/') !== 0) {
                    console.warn('Selected file is not an image.');
                    uploadInput.value = '';
                    return;
                }
                var maxBytes = 20 * 1024 * 1024; // 20 MB
                if (typeof file.size === 'number' && file.size > maxBytes) {
                    console.warn('Selected image exceeds the 20 MB limit.');
                    if (hintElement)
                        hintElement.textContent = 'Image is too large (max 20 MB).';
                    uploadInput.value = '';
                    return;
                }
                var reader = new FileReader();
                reader.onload = function(loadEvt) {
                    var dataUrl = typeof loadEvt.target.result === 'string' ? loadEvt.target.result : '';
                    if (!dataUrl)
                        return;
                    if (hintElement)
                        hintElement.textContent = hintDefaultText;
                    var entry = window.storyNodeEditor.registerImage({
                        dataUrl: dataUrl,
                        name: file && file.name ? file.name : '',
                        size: file && typeof file.size === 'number' ? file.size : 0,
                        addedAt: Date.now()
                    });
                    renderImages();
                    if (isPickerMode && entry && currentOptions && typeof currentOptions.onSelect === 'function') {
                        currentOptions.onSelect(entry);
                        closeModal();
                    }
                };
                reader.onerror = function(err) {
                    console.error('Failed to read image file', err);
                };
                reader.readAsDataURL(file);
                uploadInput.value = '';
            });
        }

        if (deleteButton) {
            deleteButton.addEventListener('click', function(evt) {
                evt.preventDefault();
                deleteSelectedEntry();
            });
        }

        return {
            open: function(options) {
                openModal(options || {});
            },
            close: closeModal,
            refresh: function() {
                if (isOpen)
                    renderImages();
            },
            isOpen: function() {
                return isOpen;
            }
        };
    }


    function createNewNode() {
        let rect = paper.el.getBoundingClientRect();
        let centerX = rect.width / 2;
        let centerY = rect.height / 2;
        let centerPoint = paper.clientToLocalPoint({
            x: centerX,
            y: centerY
        });;

        let newNode = new joint.shapes.html.Element({
            position: {
                x: centerPoint.x,
                y: centerPoint.y
            },
            fields: {
                title: '',
                content: '',
                image: '',
                choices: []
            }
        });
        newNode.updateInPorts();
        newNode.addTo(graph);
    }

    function collectDiagramData() {
        const cells = graph.getCells();
        const nodes = cells.filter(cell => cell.isElement());
        const links = cells.filter(cell => cell.isLink());

        const storyNodes = [];

        // Map node IDs to their data for easy lookup
        const nodeDataMap = {};

        // First pass: Process nodes and initialize nodeDataMap
        nodes.forEach(node => {
            const nodeId = node.id;
            const nodePosition = node.position();
            const nodeTitle = node.prop(['fields', 'title']) || '';
            const nodeText = node.prop(['fields', 'content']) || '';
            const nodeImage = node.prop(['fields', 'image']) || '';
            const nodeChoices = node.prop(['fields', 'choices']) || [];

            // Prepare the basic node data
            const nodeData = {
                id: nodeId,
                title: nodeTitle,
                text: nodeText,
                position: {
                    x: nodePosition.x,
                    y: nodePosition.y
                }
            };
            if (nodeImage)
                nodeData.image = nodeImage;

            // If the node has choices, initialize the choices array with placeholder objects
            if (nodeChoices.length > 0) {
                nodeData.choices = [];
                nodeChoices.forEach((choiceText, index) => {
                    const choiceData = {
                        choiceOrder: index,
                        choiceText: choiceText,
                        nextStoryNodeId: null
                    };
                    nodeData.choices.push(choiceData);
                });
            }

            // Store the node data
            nodeDataMap[nodeId] = nodeData;
        });

        // Second pass: Process links to determine the next nodes
        links.forEach(link => {
            const sourceId = link.get('source').id;
            const targetId = link.get('target').id;
            const sourcePort = link.get('source').port;

            if (sourceId && targetId) {
                const sourceNode = nodeDataMap[sourceId];
                if (!sourceNode) return;

                if (sourceNode.choices !== undefined) {
                    // The node has choices; associate the link with the correct choice
                    // Extract the index from the port ID (e.g., 'choice1_...')
                    const portId = sourcePort;
                    const match = portId.match(/^choice(\d+)_/);
                    if (match) {
                        const choiceIndex = parseInt(match[1], 10) - 1;
                        if (sourceNode.choices[choiceIndex]) {
                            sourceNode.choices[choiceIndex].nextStoryNodeId = targetId;
                        }
                    }
                } else {
                    // For nodes without choices, set nextStoryNodeId
                    sourceNode.nextStoryNodeId = targetId;
                }
            }
        });

        // No need for a third pass over nodes to finalize choices
        // Choices are already properly populated with nextStoryNodeId

        // Prepare the final storyNodes array
        const storyNodesPayload = Object.values(nodeDataMap);

        const payload = {
            storyTitle: 'Your Story Title',
            storyNodes: storyNodesPayload
        };

        return payload;
    }


})(joint, V);
