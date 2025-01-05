(function(joint, util, V) {
    let Element = joint.dia.Element;
    let ElementView = joint.dia.ElementView;

    Element.define('html.Element', {
            size: {
                width: 300,
                height: 228
            },
            fields: {
                content: '',
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
                                cy: -4,
                                fill: '#63C763',
                                stroke: '#565553'
                            }
                        },
                    },
                    out: {
                        position: {
                            name: 'bottom'
                        },
                        attrs: {
                            portBody: {
                                magnet: 'active',
                                r: 10,
                                cy: 20,
                                fill: '#6363C7',
                                stroke: '#565553'
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

                    <label class="node-label">
                        <textarea placeholder="..." rows="6" @group-selector="field" class="node-textarea" data-attribute="content" style="pointer-events: auto;">
                        </textarea>
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

            this.paper.htmlContainer.appendChild(html);
            this.html = html;
            this.fields = fields;
            html.setAttribute('model-id', this.model.id);

            this.html = html;
        },

        removeHTMLMarkup: function() {
            let html = this.html;
            if (!html) return;
            this.paper.htmlContainer.removeChild(html);
            this.html = null;
            this.fields = null;
        },

        updateHTML: function() {
            let bbox = this.model.getBBox();
            let html = this.html;
            html.style.width = bbox.width + 'px';
            html.style.height = bbox.height + 'px';
            html.style.left = bbox.x + 'px';
            html.style.top = bbox.y + 'px';
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

        updateFields: function() {
            this.fields.forEach(function(field) {
                let attribute = field.dataset.attribute;
                let value = this.model.prop(['fields', attribute]);
                switch (field.tagName.toUpperCase()) {
                    case 'TEXTAREA':
                        field.value = value;
                        if (value)
                            field.classList.remove('field-empty');
                        else
                            field.classList.add('field-empty');
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
                    case 'DIV':
                        field.dataset[attribute] = value;
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
        },

        adjustNodeSize: function() {
            let html = this.html;

            // Force reflow
            html.style.display = 'none';
            html.offsetHeight; // Reading offsetHeight forces reflow
            html.style.display = '';

            // Now get the accurate dimensions
            let width = html.offsetWidth;
            let height = html.offsetHeight;

            // Update the model size
            this.model.resize(width, height);
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

            this.model.addPort({
                //id: joint.util.uuid(), 
                id: 'choice' + (choices.length) + '_' + this.model.id,
                group: 'choiceOut',
                args: {
                    x: 300,
                    y: 247 + ((choices.length - 1) * 40),
                }
            });

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
        }

    });
})(joint, joint.util, V);