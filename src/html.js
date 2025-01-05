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
                paper.scaleContentToFit();
                zoomLevel = paper.scale().sx;
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

    document.getElementById('new-node').addEventListener('click', function() {
        createNewNode();
    }, {
        passive: true
    });

    document.getElementById('save').addEventListener('click', function() {
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
    // *************** END-TOOLBAR ***************

    // *************** MOUSE WHEEL ZOOM ***************
    window.addEventListener('wheel', function(event) {
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
        passive: false
    });
    // *************** END-MOUSE WHEEL ZOOM ***************

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
                content: ''
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
            const nodeText = node.prop(['fields', 'content']) || '';
            const nodeChoices = node.prop(['fields', 'choices']) || [];

            // Prepare the basic node data
            const nodeData = {
                id: nodeId,
                text: nodeText,
                position: {
                    x: nodePosition.x,
                    y: nodePosition.y
                }
            };

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