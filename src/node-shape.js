(function(joint, util, V) {
    let Element = joint.dia.Element;
    let ElementView = joint.dia.ElementView;

    Element.define('html.Element', {
            size: {
                width: 340,
                height: 280
            },
            fields: {
                title: '',
                content: '',
                image: '',
                choices: []
            },
            attrs: {
                root: {
                    magnet: false
                },
                placeholder: {
                    width: 'calc(w)',
                    height: 'calc(h)',
                    fill: 'transparent',
                    stroke: '#D4D4D4'
                }
            },
            ports: {
                items: [{
                    group: 'out'
                }],
                groups: {
                    in: {
                        position: {
                            name: 'top'
                        },
                        attrs: {
                            portBody: {
                                magnet: 'passive',
                                r: 10,
                                cy: -8,
                                fill: '#63C763',
                                stroke: '#565553'
                            }
                        },
                    },
                    out: {
                        position: {
                            name: 'absolute'
                        },
                        attrs: {
                            portBody: {
                                magnet: 'active',
                                r: 10,
                                cx: 0,
                                cy: 20,
                                fill: '#6363C7',
                                stroke: '#565553',
                                'layer': 'overlay'
                            }
                        },
                    },
                    choiceOut: {
                        position: {
                            name: 'absolute'
                        },
                        attrs: {
                            portBody: {
                                magnet: 'active',
                                r: 10,
                                cx: 5,
                                fill: '#C7C729',
                                stroke: '#565553',
                                'layer': 'overlay'
                            }
                        }
                    }
                }
            },
            portBody: {
                magnet: true,
                r: 10,
                fill: '#A4A699',
                stroke: '#565553',

            }
        },

        {
            portMarkup: [{
                tagName: 'circle',
                selector: 'portBody'
            }],

            htmlMarkup: util.svg`
            <foreignObject>
                <div @selector="htmlRoot" @group-selector="field" xmlns="http://www.w3.org/1999/xhtml"
                    class="node"
                    style="position: absolute; pointer-events: auto; user-select: none; box-sizing: border-box;"
                >

                    <button class="delete-button">
                        <img src="assets/delete-icon.svg" alt="Delete" />
                    </button>

                    <div @group-selector="field" class="node-title-display" data-attribute="title"></div>

                    <div class="node-image-section">
                        <div class="node-image-actions">
                            <button class="node-image-button" type="button" title="Add image">
                                <span class="node-image-button-label">Add image</span>
                            </button>
                            <button class="node-image-remove-button" type="button" title="Remove image" aria-label="Remove image">x</button>
                        </div>
                        <input class="node-image-input" type="file" accept="image/*" aria-hidden="true" style="display: none;" />
                        <div @group-selector="field" class="node-image-display field-empty" data-attribute="image">
                            <img class="node-image-element" alt="Node image" />
                        </div>
                    </div>

                    <label class="node-label">
                        <div @group-selector="field" class="node-content-display" data-attribute="content" tabindex="0" style="pointer-events: auto;"></div>
                    </label>

                    <div class="choices-section">
                        <div class="choices-header">
                            <span>Choices</span>
                            <button class="add-choice-button">+</button>
                        </div>

                        <div class="choices-container" @selector="choicesContainer"></div>

                    </div>

                </div>
            </foreignObject>
        `,

            markup: util.svg`
            <rect @selector="placeholder" />
        `,

            getGroupPorts: function(group) {
                return this.getPorts().filter(function(port) {
                    return port.group === group;
                });
            },

            getUsedInPorts: function() {
                const graph = this.graph;
                if (!graph) return [];
                const connectedLinks = graph.getConnectedLinks(this, {
                    inbound: true
                });
                return connectedLinks.map(function(link) {
                    return this.getPort(link.target().port);
                }, this);
            },

            getNewInPorts: function(number) {
                return Array.from({
                    length: number
                }, function() {
                    return {
                        group: 'in'
                    };
                });
            },

            updateInPorts: function() {
                const minNumberOfPorts = 1;
                const ports = this.getGroupPorts('in');
                const usedPorts = this.getUsedInPorts();
                const newPorts = this.getNewInPorts(Math.max(minNumberOfPorts - usedPorts.length, 1));
                if (ports.length === minNumberOfPorts && ports.length - usedPorts.length > 0) {
                    // No action needed
                } else if (ports.length === usedPorts.length) {
                    this.addPorts(newPorts);
                } else if (ports.length + 1 > usedPorts.length) {
                    this.prop(['ports', 'items'], this.getGroupPorts('out').concat(usedPorts).concat(newPorts), {
                        rewrite: true
                    });
                }
            }
        });

    // Custom view for JointJS HTML element that displays an HTML <div></div> above the SVG Element.
    joint.shapes.html.ElementView = ElementView.extend({

        html: null,
        _alignChoicePortsFrame: null,

        presentationAttributes: ElementView.addPresentationAttributes({
            position: ['HTML_UPDATE'],
            size: ['HTML_UPDATE'],
            fields: ['HTML_FIELD_UPDATE'],
            z: ['HTML_Z_INDEX'],
            ports: ['UPDATE']
        }),

        // Run upon first render
        initFlag: ElementView.prototype.initFlag.concat([
            'HTML_UPDATE',
            'HTML_FIELD_UPDATE',
            'HTML_Z_INDEX'
        ]),

        initialize: function() {
            ElementView.prototype.initialize.apply(this, arguments);
            this._alignChoicePortsFrame = null;
            let size = this.model.get('size') || {};
            let defaultWidth = typeof size.width === 'number' && size.width > 0 ? size.width : 340;
            let defaultHeight = typeof size.height === 'number' && size.height > 0 ? size.height : 280;
            this.defaultSize = {
                width: defaultWidth,
                height: defaultHeight
            };
            this.baseChoicesHeight = 0;
        },

        getPaperScale: function() {
            let defaultScale = {
                sx: 1,
                sy: 1
            };
            if (!this.paper || typeof this.paper.scale !== 'function')
                return defaultScale;
            let currentScale = this.paper.scale() || {};
            let sx = typeof currentScale.sx === 'number' && currentScale.sx !== 0 ? currentScale.sx : 1;
            let sy = typeof currentScale.sy === 'number' && currentScale.sy !== 0 ? currentScale.sy : sx;
            return {
                sx: sx,
                sy: sy
            };
        },

        confirmUpdate: function(flags) {
            // Call base class confirmUpdate first
            flags = ElementView.prototype.confirmUpdate.call(this, flags);

            // Process custom flags
            if (this.hasFlag(flags, 'HTML_UPDATE')) {
                this.updateHTML();
                flags = this.removeFlag(flags, 'HTML_UPDATE');
            }
            if (this.hasFlag(flags, 'HTML_FIELD_UPDATE')) {
                this.updateFields();
                flags = this.removeFlag(flags, 'HTML_FIELD_UPDATE');
            }
            if (this.hasFlag(flags, 'HTML_Z_INDEX')) {
                this.updateZIndex();
                flags = this.removeFlag(flags, 'HTML_Z_INDEX');
            }
            return flags;
        },

        onRender: function() {
            this.removeHTMLMarkup();
            this.renderHTMLMarkup();
            return this;
        },

        renderHTMLMarkup: function() {
            let doc = util.parseDOMJSON(this.model.htmlMarkup, V.namespace.xhtml);
            let html = doc.selectors.htmlRoot;
            let fields = doc.groupSelectors.field;

            // React on all box changes. e.g., input change
            html.addEventListener('change', this.onFieldChange.bind(this), false);

            // Attach event listener to the '+' button
            let addChoiceButton = html.querySelector('.add-choice-button');
            if (addChoiceButton)
                addChoiceButton.addEventListener('click', this.onAddChoice.bind(this));

            // Attach event listener to the delete button
            let deleteButton = html.querySelector('.delete-button');
            if (deleteButton)
                deleteButton.addEventListener('click', this.onDeleteNode.bind(this));

            // Attach event listener to the choices container for input events
            this.choicesContainer = html.querySelector('.choices-container');
            if (this.choicesContainer)
                this.choicesContainer.addEventListener('input', this.onChoiceInput.bind(this), {
                    passive: true
                });

            this.imageButton = html.querySelector('.node-image-button');
            if (this.imageButton)
                this.imageButton.addEventListener('click', this.onImageButtonClick.bind(this));
            this.imageRemoveButton = html.querySelector('.node-image-remove-button');
            if (this.imageRemoveButton) {
                this.imageRemoveButton.addEventListener('click', this.onImageRemove.bind(this));
                this.imageRemoveButton.style.display = 'none';
            }
            this.imageInput = html.querySelector('.node-image-input');
            if (this.imageInput) {
                this.imageInput.style.display = 'none';
                this.imageInput.addEventListener('change', this.onImageInputChange.bind(this));
            }
            this.imageDisplay = html.querySelector('.node-image-display');
            this.imageElement = html.querySelector('.node-image-element');
            if (this.imageElement) {
                this.imageElement.addEventListener('load', this.onImageLoad.bind(this));
                this.imageElement.addEventListener('error', this.onImageError.bind(this));
            }

            let titleDisplay = html.querySelector('.node-title-display');
            if (titleDisplay)
                titleDisplay.addEventListener('click', function(evt) {
                    evt.preventDefault();
                    evt.stopPropagation();
                });
            let contentDisplay = html.querySelector('.node-content-display');
            if (contentDisplay) {
                contentDisplay.addEventListener('click', this.onContentClick.bind(this));
                contentDisplay.addEventListener('keydown', this.onContentKeydown.bind(this));
            }

            this.paper.htmlContainer.appendChild(html);
            this.html = html;
            this.fields = fields;
            html.setAttribute('model-id', this.model.id);

            this.baseChoicesHeight = this.choicesContainer ? this.choicesContainer.scrollHeight : 0;

            this.html = html;
        },

        removeHTMLMarkup: function() {
            let html = this.html;
            if (!html) return;
            this.paper.htmlContainer.removeChild(html);
            this.html = null;
            this.fields = null;
            this.imageButton = null;
            this.imageRemoveButton = null;
            this.imageInput = null;
            this.imageDisplay = null;
            this.imageElement = null;
        },

        updateHTML: function() {
            let bbox = this.model.getBBox();
            let html = this.html;
            html.style.width = bbox.width + 'px';
            html.style.height = bbox.height + 'px';
            html.style.left = bbox.x + 'px';
            html.style.top = bbox.y + 'px';
            this.scheduleChoicePortAlignment();
        },

        onFieldChange: function(evt) {
            let input = evt.target;
            let attribute = input.dataset.attribute;
            if (attribute) {
                this.model.prop(['fields', attribute], input.value);
            }
        },

        onDeleteNode: function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            this.model.remove();
        },

        onContentClick: function(evt) {
            evt.preventDefault();
            evt.stopPropagation();

            if (!window.storyNodeEditor || !window.storyNodeEditor.openTextEditor)
                return;

            let initialContent = this.model.prop(['fields', 'content']) || '';
            let initialTitle = this.model.prop(['fields', 'title']) || '';
            let self = this;
            window.storyNodeEditor.openTextEditor({
                initialContent: initialContent,
                initialTitle: initialTitle,
                onSave: function(result) {
                    if (result && typeof result === 'object') {
                        var updatedContent = typeof result.content === 'string' ? result.content : '';
                        var updatedTitle = typeof result.title === 'string' ? result.title.trim() : '';
                        self.model.prop(['fields', 'content'], updatedContent);
                        self.model.prop(['fields', 'title'], updatedTitle);
                    } else if (typeof result === 'string') {
                        self.model.prop(['fields', 'content'], result);
                    }
                }
            });
        },

        onContentKeydown: function(evt) {
            if (evt.key === 'Enter' || evt.key === ' ') {
                evt.preventDefault();
                this.onContentClick(evt);
            }
        },

        onImageButtonClick: function(evt) {
            evt.preventDefault();
            evt.stopPropagation();

            if (window.storyNodeEditor && typeof window.storyNodeEditor.openImageLibrary === 'function') {
                let self = this;
                window.storyNodeEditor.openImageLibrary({
                    title: 'Select Image',
                    allowUpload: true,
                    onSelect: function(entry) {
                        if (!entry || typeof entry !== 'object')
                            return;
                        let dataUrl = typeof entry.dataUrl === 'string' ? entry.dataUrl : '';
                        if (!dataUrl)
                            return;
                        self.model.prop(['fields', 'image'], dataUrl);
                        if (window.storyNodeEditor && typeof window.storyNodeEditor.notifyImageUsageChange === 'function')
                            window.storyNodeEditor.notifyImageUsageChange();
                    }
                });
                return;
            }

            if (!this.imageInput)
                return;
            // Fallback: open file picker directly
            this.imageInput.value = '';
            this.imageInput.click();
        },

        onImageInputChange: function(evt) {
            if (evt)
                evt.stopPropagation();
            let input = evt.target;
            if (!input || !input.files || !input.files.length)
                return;

            let file = input.files[0];
            if (!file) return;

            let maxBytes = 20 * 1024 * 1024; // 20 MB
            if (typeof file.size === 'number' && file.size > maxBytes) {
                console.warn('Selected image exceeds the 20 MB limit.');
                input.value = '';
                return;
            }

            if (file.type && file.type.indexOf('image/') !== 0) {
                console.warn('Selected file is not an image.');
                input.value = '';
                return;
            }

            let reader = new FileReader();
            reader.onload = function(loadEvt) {
                let dataUrl = typeof loadEvt.target.result === 'string' ? loadEvt.target.result : '';
                if (dataUrl) {
                    this.model.prop(['fields', 'image'], dataUrl);
                    if (window.storyNodeEditor && typeof window.storyNodeEditor.registerImage === 'function') {
                        window.storyNodeEditor.registerImage({
                            dataUrl: dataUrl,
                            name: file && typeof file.name === 'string' ? file.name : '',
                            size: file && typeof file.size === 'number' ? file.size : 0,
                            addedAt: Date.now()
                        });
                    }
                    if (window.storyNodeEditor && typeof window.storyNodeEditor.notifyImageUsageChange === 'function')
                        window.storyNodeEditor.notifyImageUsageChange();
                }
            }.bind(this);
            reader.onerror = function(err) {
                console.error('Failed to read image file', err);
            };
            reader.readAsDataURL(file);
        },

        onImageRemove: function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            this.model.prop(['fields', 'image'], '');
            if (this.imageInput)
                this.imageInput.value = '';
            if (window.storyNodeEditor && typeof window.storyNodeEditor.notifyImageUsageChange === 'function')
                window.storyNodeEditor.notifyImageUsageChange();
        },

        onImageLoad: function() {
            this.adjustNodeSize();
        },

        onImageError: function() {
            if (this.imageElement)
                this.imageElement.removeAttribute('src');
            if (this.model && this.model.prop(['fields', 'image']))
                this.model.prop(['fields', 'image'], '');
        },

        updateFields: function() {
            this.fields.forEach(function(field) {
                let attribute = field.dataset.attribute;
                let value = this.model.prop(['fields', attribute]);
                switch (field.tagName.toUpperCase()) {
                    case 'DIV':
                        if (field.classList.contains('node-content-display')) {
                            if (value) {
                                var rendered = value;
                                if (window.storyNodeEditor && typeof window.storyNodeEditor.renderMarkdown === 'function')
                                    rendered = window.storyNodeEditor.renderMarkdown(value);
                                field.innerHTML = rendered;
                                field.classList.remove('field-empty');
                            } else {
                                field.innerHTML = '<span class="node-content-placeholder">...</span>';
                                field.classList.add('field-empty');
                            }
                        } else if (field.classList.contains('node-title-display')) {
                            if (value) {
                                field.textContent = value;
                                field.classList.remove('field-empty');
                            } else {
                                field.textContent = '';
                                field.classList.add('field-empty');
                            }
                        } else if (field.classList.contains('node-image-display')) {
                            let imageElement = field.querySelector('.node-image-element');
                            if (value) {
                                if (imageElement && imageElement.src !== value)
                                    imageElement.src = value;
                                field.classList.remove('field-empty');
                            } else {
                                if (imageElement) {
                                    imageElement.removeAttribute('src');
                                    imageElement.src = '';
                                }
                                field.classList.add('field-empty');
                            }
                            if (this.imageRemoveButton)
                                this.imageRemoveButton.style.display = value ? 'inline-flex' : 'none';
                        } else if (attribute) {
                            field.dataset[attribute] = value;
                        }
                        break;
                    case 'LABEL':
                        field.textContent = value;
                        break;
                    case 'INPUT':
                    case 'SELECT':
                        field.value = value;
                        if (value)
                            field.classList.remove('field-empty');
                        else
                            field.classList.add('field-empty');
                        break;
                    case 'TEXTAREA':
                        field.value = value;
                        if (value)
                            field.classList.remove('field-empty');
                        else
                            field.classList.add('field-empty');
                        break;
                }
            }.bind(this));

            this.updateChoices();
        },

        updateChoices: function() {
            let choicesContainer = this.html.querySelector('.choices-container');
            let choices = this.model.prop(['fields', 'choices']) || [];

            // Initialize choiceInputs array if it doesn't exist
            if (!this.choiceInputs)
                this.choiceInputs = [];

            // If the number of choices has changed, re-create inputs
            if (choices.length !== this.choiceInputs.length) {
                // Clear existing choices
                choicesContainer.innerHTML = '';
                this.choiceInputs = [];

                choices.forEach(function(choice, index) {
                    let choiceDiv = document.createElement('div');
                    choiceDiv.className = 'choice';

                    let input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'choice-input';
                    input.value = choice;
                    input.dataset.index = index;
                    input.placeholder = `Choice ${index + 1}`;

                    choiceDiv.appendChild(input);
                    choicesContainer.appendChild(choiceDiv);

                    // Store reference to input
                    this.choiceInputs.push(input);
                }, this);

                // Adjust node size
                this.adjustNodeSize();
            } else {
                // Update values of existing inputs
                choices.forEach(function(choice, index) {
                    let input = this.choiceInputs[index];
                    input.value = choice;
                }, this);
            }

            this.adjustNodeSize();
            this.scheduleChoicePortAlignment();
        },

        adjustNodeSize: function() {
            if (!this.html)
                return;

            let defaultWidth = (this.defaultSize && typeof this.defaultSize.width === 'number') ? this.defaultSize.width : 340;
            let defaultHeight = (this.defaultSize && typeof this.defaultSize.height === 'number') ? this.defaultSize.height : 280;

            let html = this.html;
            html.style.width = defaultWidth + 'px';
            html.style.height = 'auto';

            // Force layout update to ensure accurate scroll measurements
            html.getBoundingClientRect();

            // Measure the rendered height (in DOM pixels, matching model units at scale 1)
            let measuredHeightPx = Math.max(defaultHeight, Math.round(Math.max(html.scrollHeight, html.offsetHeight)));

            let currentSize = this.model.get('size') || {};
            let currentHeight = typeof currentSize.height === 'number' ? currentSize.height : defaultHeight;
            let currentWidth = typeof currentSize.width === 'number' ? currentSize.width : defaultWidth;
            let heightChanged = Math.abs(currentHeight - measuredHeightPx) >= 0.5;
            let widthChanged = Math.abs(currentWidth - defaultWidth) >= 0.5;

            if (!heightChanged && !widthChanged) {
                html.style.height = currentHeight + 'px';
            } else {
                html.style.height = measuredHeightPx + 'px';
                this.model.resize(defaultWidth, measuredHeightPx);
            }

            if (!html.style.height)
                html.style.height = measuredHeightPx + 'px';

            this.scheduleChoicePortAlignment();
        },

        scheduleChoicePortAlignment: function() {
            if (!this.html)
                return;

            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                if (this._alignChoicePortsFrame != null)
                    window.cancelAnimationFrame(this._alignChoicePortsFrame);
                this._alignChoicePortsFrame = window.requestAnimationFrame(function() {
                    this._alignChoicePortsFrame = null;
                    this.alignChoicePorts();
                    this.alignMainOutPort();
                }.bind(this));
            } else {
                this.alignChoicePorts();
                this.alignMainOutPort();
            }
        },

        alignChoicePorts: function() {
            if (!this.html)
                return;

            let choiceElements = Array.from(this.html.querySelectorAll('.choices-container .choice'));
            if (!choiceElements.length)
                return;

            let ports = this.model.getPorts().filter(function(port) {
                return port.group === 'choiceOut';
            });

            if (!ports.length)
                return;

            let scale = this.getPaperScale();
            let scaleX = scale.sx || 1;
            let scaleY = scale.sy || 1;

            let size = this.model.get('size') || {};
            let nodeWidth = typeof size.width === 'number' ? size.width : 0;
            if (!(nodeWidth > 0)) {
                nodeWidth = this.html ? this.html.offsetWidth : 0;
                if (nodeWidth > 0 && scaleX)
                    nodeWidth = nodeWidth / scaleX;
            }
            if (!(nodeWidth > 0))
                nodeWidth = 340;

            let htmlRect = this.html.getBoundingClientRect();

            let mappedPorts = ports.map(function(port) {
                let match = port.id && port.id.match(/^choice(\d+)_/);
                return {
                    port: port,
                    index: match ? parseInt(match[1], 10) - 1 : null
                };
            }).filter(function(entry) {
                return entry.index !== null && !isNaN(entry.index);
            }).sort(function(a, b) {
                return a.index - b.index;
            });

            mappedPorts.forEach(function(entry) {
                let choiceElement = choiceElements[entry.index];
                if (!choiceElement)
                    return;

                let target = choiceElement.querySelector('.choice-input') || choiceElement;
                let rect = target.getBoundingClientRect();
                let offsetY = (rect.top + rect.height / 2) - htmlRect.top;

                if (scaleY)
                    offsetY = offsetY / scaleY;

                this.model.portProp(entry.port.id, 'args/x', nodeWidth);
                this.model.portProp(entry.port.id, 'args/y', offsetY);
            }, this);
        },

        alignMainOutPort: function() {
            if (!this.html)
                return;

            let choices = this.model.prop(['fields', 'choices']) || [];
            if (choices.length > 0)
                return;

            let outPort = this.model.getPorts().find(function(port) {
                return port.group === 'out';
            });
            if (!outPort)
                return;

            let scale = this.getPaperScale();
            let scaleX = scale.sx || 1;
            let scaleY = scale.sy || 1;

            let size = this.model.get('size') || {};
            let nodeWidth = typeof size.width === 'number' ? size.width : 0;
            if (!(nodeWidth > 0)) {
                nodeWidth = this.html ? this.html.offsetWidth : 0;
                if (nodeWidth > 0 && scaleX)
                    nodeWidth = nodeWidth / scaleX;
            }
            if (!(nodeWidth > 0))
                nodeWidth = 340;

            let nodeHeight = typeof size.height === 'number' ? size.height : 0;
            if (!(nodeHeight > 0)) {
                nodeHeight = this.html ? this.html.offsetHeight : 0;
                if (nodeHeight > 0 && scaleY)
                    nodeHeight = nodeHeight / scaleY;
            }
            if (!(nodeHeight > 0))
                nodeHeight = 260;

            let offsetX = nodeWidth / 2;
            if (!(offsetX > 0))
                offsetX = nodeWidth || 170;

            let offsetY = nodeHeight - 12;
            if (!(offsetY > 0))
                offsetY = Math.max(nodeHeight, 40);

            this.model.portProp(outPort.id, 'args/x', offsetX);
            this.model.portProp(outPort.id, 'args/y', offsetY);
        },

        onAddChoice: function(evt) {
            evt.preventDefault();

            // Get the current choices from the model
            let choices = this.model.prop(['fields', 'choices']) || [];
            // Create a copy and add a new empty choice
            choices = choices.slice();
            choices.push('');
            // Update the model's choices
            this.model.prop(['fields', 'choices'], choices);

            // Remove the main out port if it's present, like in the case of the first choice being added
            let outPort = this.model.getPorts().filter(port => port.group === 'out');
            if (outPort[0]) {
                this.model.removePort(outPort[0].id);
            }

            let size = this.model.get('size') || {};
            let scale = this.getPaperScale();
            let scaleX = scale.sx || 1;
            let scaleY = scale.sy || 1;

            let nodeWidth = typeof size.width === 'number' ? size.width : 0;
            if (!(nodeWidth > 0)) {
                nodeWidth = this.html ? this.html.offsetWidth : 0;
                if (nodeWidth > 0 && scaleX)
                    nodeWidth = nodeWidth / scaleX;
            }
            if (!(nodeWidth > 0))
                nodeWidth = 340;

            let nodeHeight = typeof size.height === 'number' ? size.height : 0;
            if (!(nodeHeight > 0)) {
                nodeHeight = this.html ? this.html.offsetHeight : 0;
                if (nodeHeight > 0 && scaleY)
                    nodeHeight = nodeHeight / scaleY;
            }
            if (!(nodeHeight > 0))
                nodeHeight = 200 + ((choices.length - 1) * 40);

            this.model.addPort({
                //id: joint.util.uuid(), 
                id: 'choice' + (choices.length) + '_' + this.model.id,
                group: 'choiceOut',
                args: {
                    x: nodeWidth,
                    y: nodeHeight,
                }
            });

            this.scheduleChoicePortAlignment();

            console.log('ports:', this.model.getPorts());
        },

        // Handle input changes in choice fields
        onChoiceInput: function(evt) {
            let input = evt.target;
            if (input.classList.contains('choice-input')) {
                let index = input.dataset.index;

                // Get the current choices
                let choices = this.model.prop(['fields', 'choices']) || [];

                // Create a copy and update the specific choice
                choices = choices.slice();
                choices[index] = input.value;

                // Update the model's choices
                this.model.prop(['fields', 'choices'], choices);
            }
        },

        updateZIndex: function() {
            this.html.style.zIndex = this.model.get('z') || 0;
        },

        onRemove: function() {
            this.removeHTMLMarkup();
        },

        // Detach and attach the HTML element to the paper's HTML container
        // in case the paper `viewport` option is in use.
        onMount: function(isInitialize) {
            ElementView.prototype.onMount.apply(this, arguments);
            let html = this.html;
            if (!isInitialize && html)
                this.paper.htmlContainer.appendChild(html);
        },

        onDetach: function() {
            ElementView.prototype.onDetach.apply(this, arguments);
            let html = this.html;
            if (html && html.isConnected)
                this.paper.htmlContainer.removeChild(html);
            if (typeof window !== 'undefined' && this._alignChoicePortsFrame != null) {
                window.cancelAnimationFrame(this._alignChoicePortsFrame);
                this._alignChoicePortsFrame = null;
            }
        }

    });
})(joint, joint.util, V);
