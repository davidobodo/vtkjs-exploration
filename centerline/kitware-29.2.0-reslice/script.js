import "@kitware/vtk.js/favicon";

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import "@kitware/vtk.js/Rendering/Profiles/All";

// Ensure global is available in browser environment
window.global = window.global || window;

// Force the loading of HttpDataAccessHelper to support gzip decompression
import "@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper";

import { ViewTypes } from "@kitware/vtk.js/Widgets/Core/WidgetManager/Constants";
import { radiansFromDegrees } from "@kitware/vtk.js/Common/Core/Math";
import { vec3 } from "gl-matrix";
import vtkFullScreenRenderWindow from "@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
import vtkHttpDataSetReader from "@kitware/vtk.js/IO/Core/HttpDataSetReader";
import vtkImageMapper from "@kitware/vtk.js/Rendering/Core/ImageMapper";
import vtkImageReslice from "@kitware/vtk.js/Imaging/Core/ImageReslice";
import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice";
import vtkInteractorStyleImage from "@kitware/vtk.js/Interaction/Style/InteractorStyleImage";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkResliceCursorWidget from "@kitware/vtk.js/Widgets/Widgets3D/ResliceCursorWidget";
import vtkWidgetManager from "@kitware/vtk.js/Widgets/Core/WidgetManager";
import widgetBehavior from "@kitware/vtk.js/Widgets/Widgets3D/ResliceCursorWidget/cprBehavior";

import controlPanel from "./controller.html?raw";

const volumePath = `https://kitware.github.io/vtk-js/data/volume/LIDC2.vti`;

// Initialize the app
async function initApp() {
	// ----------------------------------------------------------------------------
	// Standard rendering code setup
	// ----------------------------------------------------------------------------

	const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance();
	const renderWindow = fullScreenRenderer.getRenderWindow();

	fullScreenRenderer.addController(controlPanel);
	const centerlineEl = document.getElementById("centerline");
	const angleEl = document.getElementById("angle");
	const animateEl = document.getElementById("animate");

	const interactor = renderWindow.getInteractor();
	interactor.setInteractorStyle(vtkInteractorStyleImage.newInstance());
	interactor.setDesiredUpdateRate(15.0);

	// Reslice Cursor Widget
	const stretchPlane = "Y";
	const crossPlane = "Z";
	const widget = vtkResliceCursorWidget.newInstance({
		planes: [stretchPlane, crossPlane],
		behavior: widgetBehavior,
	});
	const crossViewType = ViewTypes.XY_PLANE;
	const widgetState = widget.getWidgetState();

	// Set size in CSS pixel space because scaleInPixels defaults to true
	widgetState.getStatesWithLabel("sphere").forEach((handle) => handle.setScale1(20));
	widgetState.getCenterHandle().setVisible(false);
	widgetState.getStatesWithLabel(`rotationIn${stretchPlane}`).forEach((handle) => handle.setVisible(false));

	const crossRenderer = vtkRenderer.newInstance();
	crossRenderer.setBackground(0.32, 0.34, 0.43);
	crossRenderer.setViewport(0, 0, 1, 1);
	renderWindow.addRenderer(crossRenderer);
	const crossWidgetManager = vtkWidgetManager.newInstance();
	crossWidgetManager.setRenderer(crossRenderer);
	const crossViewWidgetInstance = crossWidgetManager.addWidget(widget, crossViewType);

	const reslice = vtkImageReslice.newInstance();
	reslice.setTransformInputSampling(false);
	reslice.setAutoCropOutput(true);
	reslice.setOutputDimensionality(2);
	const resliceMapper = vtkImageMapper.newInstance();
	resliceMapper.setBackgroundColor(0, 0, 0, 0);
	resliceMapper.setInputConnection(reslice.getOutputPort());
	const resliceActor = vtkImageSlice.newInstance();

	// ----------------------------------------------------------------------------
	// Example code
	// ----------------------------------------------------------------------------
	// Server is not sending the .gz and with the compress header
	// Need to fetch the true file name and uncompress it locally
	// ----------------------------------------------------------------------------

	const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });

	let currentAngle = 0;

	function updateDistanceAndDirection() {
		// Cross renderer update
		widget.updateReslicePlane(reslice, crossViewType);
		resliceActor.setUserMatrix(reslice.getResliceAxes());
		widget.updateCameraPoints(crossRenderer, crossViewType, false, false, true);

		interactor.render();
		renderWindow.render();
	}

	function setAngleFromSlider(radAngle) {
		currentAngle = radAngle;
		// Rotate the widget around its center
		const widgetPlanes = widgetState.getPlanes();
		const center = widgetState.getCenter();
		
		// Create rotation around Z-axis
		const normalDir = [0, 0, 1];
		const bitangentDir = [0, 1, 0];
		vec3.rotateZ(bitangentDir, bitangentDir, [0, 0, 0], radAngle);
		
		// Update the widget planes
		widgetPlanes[crossViewType].normal = normalDir;
		widgetPlanes[crossViewType].viewUp = bitangentDir;
		widgetState.setPlanes(widgetPlanes);

		updateDistanceAndDirection();
	}

	// Load centerline data
	const aortaJSON = await fetch("./aorta_centerline.json").then((r) => r.json());
	const spineJSON = await fetch("./spine_centerline.json").then((r) => r.json());
	const centerlineJsons = { Aorta: aortaJSON, Spine: spineJSON };
	const centerlineKeys = Object.keys(centerlineJsons);

	// Create an option for each centerline
	for (let i = 0; i < centerlineKeys.length; ++i) {
		const name = centerlineKeys[i];
		const optionEl = document.createElement("option");
		optionEl.innerText = name;
		optionEl.value = name;
		centerlineEl.appendChild(optionEl);
	}

	let currentImage = null;
	function setCenterlineKey(centerlineKey) {
		if (!currentImage) {
			return;
		}
		updateDistanceAndDirection();
		renderWindow.render();
	}

	centerlineEl.addEventListener("input", () => setCenterlineKey(centerlineEl.value));

	// Read image
	reader.setUrl(volumePath).then(() => {
		reader.loadData().then(() => {
			const image = reader.getOutputData();
			widget.setImage(image);

			reslice.setInputData(image);
			resliceActor.setMapper(resliceMapper);
			crossRenderer.addActor(resliceActor);
			widget.updateReslicePlane(reslice, crossViewType);
			resliceActor.setUserMatrix(reslice.getResliceAxes());
			widget.updateCameraPoints(crossRenderer, crossViewType, true, false, true);

			currentImage = image;
			setCenterlineKey(centerlineKeys[0]);

			global.imageData = image;
		});
	});

	crossViewWidgetInstance.onInteractionEvent(updateDistanceAndDirection);

	// Angle control
	angleEl.addEventListener("input", () => {
		const degAngle = Number.parseFloat(angleEl.value, 10);
		setAngleFromSlider(radiansFromDegrees(degAngle));
	});

	// Animation control
	let animationId;
	animateEl.addEventListener("change", () => {
		if (animateEl.checked) {
			animationId = setInterval(() => {
				currentAngle += 0.05; // Slower rotation for better visibility
				const degAngle = (currentAngle * 180) / Math.PI;
				angleEl.value = degAngle % 360;
				setAngleFromSlider(currentAngle);
			}, 60);
		} else {
			clearInterval(animationId);
		}
	});

	// -----------------------------------------------------------
	// Make some variables global so that you can inspect and
	// modify objects in your browser's developer console:
	// -----------------------------------------------------------

	if (typeof global !== "undefined") {
		global.source = reader;
		global.renderWindow = renderWindow;
		global.widget = widget;
		global.reslice = reslice;
	}
} // End initApp

// Start the application
initApp().catch(console.error);