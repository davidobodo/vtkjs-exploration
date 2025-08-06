import "@kitware/vtk.js/favicon";

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import "@kitware/vtk.js/Rendering/Profiles/All";

// Ensure global is available in browser environment
window.global = window.global || window;

// Force the loading of HttpDataAccessHelper to support gzip decompression
import "@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper";

import { ViewTypes } from "@kitware/vtk.js/Widgets/Core/WidgetManager/Constants";
import { radiansFromDegrees } from "@kitware/vtk.js/Common/Core/Math";
import { updateState } from "@kitware/vtk.js/Widgets/Widgets3D/ResliceCursorWidget/helpers";
import { vec3, mat3, mat4 } from "gl-matrix";
import vtkCPRManipulator from "@kitware/vtk.js/Widgets/Manipulators/CPRManipulator";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkImageCPRMapper from "@kitware/vtk.js/Rendering/Core/ImageCPRMapper";
import vtkPlaneManipulator from "@kitware/vtk.js/Widgets/Manipulators/PlaneManipulator";
import vtkPolyData from "@kitware/vtk.js/Common/DataModel/PolyData";
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

//------------------------------------------------
// RESLICE VIEWPORT SETUP
//------------------------------------------------
function setupResliceContainer() {
	const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
		container: document.getElementById("reslice-container"),
	});
	const renderWindow = fullScreenRenderer.getRenderWindow();
	const renderer = fullScreenRenderer.getRenderer();
	fullScreenRenderer.addController(controlPanel);

	const interactor = renderWindow.getInteractor();
	interactor.setInteractorStyle(vtkInteractorStyleImage.newInstance());
	interactor.setDesiredUpdateRate(15.0);

	return { renderWindow, renderer, interactor };
}

//------------------------------------------------
// MAIN IMAGE VIEWPORT SETUP
//------------------------------------------------
function setupMainImageContainer() {
	const mainViewRenderer = vtkFullScreenRenderWindow.newInstance({
		container: document.getElementById("main-view-container"),
	});
	const renderWindow = mainViewRenderer.getRenderWindow();
	const renderer = mainViewRenderer.getRenderer();

	const interactor = renderWindow.getInteractor();
	interactor.setInteractorStyle(vtkInteractorStyleImage.newInstance());
	interactor.setDesiredUpdateRate(15.0);

	return { renderWindow, renderer, interactor };
}

//------------------------------------------------
// CONTROL ELEMENTS
//------------------------------------------------
function getControlElements() {
	return {
		centerlineEl: document.getElementById("centerline"),
		angleEl: document.getElementById("angle"),
		animateEl: document.getElementById("animate"),
	};
}

function createInteractiveCrosshair() {
	const stretchPlane = "Y";
	const crossPlane = "Z";
	const widget = vtkResliceCursorWidget.newInstance({
		planes: [stretchPlane, crossPlane],
		behavior: widgetBehavior,
	});
	const stretchViewType = ViewTypes.XZ_PLANE;
	const crossViewType = ViewTypes.XY_PLANE;
	const widgetState = widget.getWidgetState();

	// Set size in CSS pixel space because scaleInPixels defaults to true
	widgetState.getStatesWithLabel("sphere").forEach((handle) => handle.setScale1(20));
	widgetState.getCenterHandle().setVisible(false);
	widgetState.getStatesWithLabel(`rotationIn${stretchPlane}`).forEach((handle) => handle.setVisible(false));

	return { widget, stretchViewType, crossViewType, widgetState, stretchPlane, crossPlane };
}

function setupResliceRenderer(renderWindow, widget, crossViewType) {
	const crossRenderer = vtkRenderer.newInstance();
	crossRenderer.setBackground(0.32, 0.34, 0.43);
	crossRenderer.setViewport(0, 0, 1, 1);
	renderWindow.addRenderer(crossRenderer);

	const crossWidgetManager = vtkWidgetManager.newInstance();
	crossWidgetManager.setRenderer(crossRenderer);
	const crossViewWidgetInstance = crossWidgetManager.addWidget(widget, crossViewType);

	return { crossRenderer, crossWidgetManager, crossViewWidgetInstance };
}

function setupMainRenderer(stretchRenderer, widget, stretchViewType) {
	const widgetManager = vtkWidgetManager.newInstance();
	widgetManager.setRenderer(stretchRenderer);
	const stretchViewWidgetInstance = widgetManager.addWidget(widget, stretchViewType);

	return { widgetManager, stretchViewWidgetInstance };
}

function setupResliceComponents() {
	const reslice = vtkImageReslice.newInstance();
	reslice.setTransformInputSampling(false);
	reslice.setAutoCropOutput(true);
	reslice.setOutputDimensionality(2);

	const resliceMapper = vtkImageMapper.newInstance();
	resliceMapper.setBackgroundColor(0, 0, 0, 0);
	resliceMapper.setInputConnection(reslice.getOutputPort());

	const resliceActor = vtkImageSlice.newInstance();

	return { reslice, resliceMapper, resliceActor };
}

function setupVolumeReader() {
	return vtkHttpDataSetReader.newInstance({ fetchGzip: true });
}

function setupCPRComponents(reader) {
	const centerline = vtkPolyData.newInstance();
	const actor = vtkImageSlice.newInstance();
	const mapper = vtkImageCPRMapper.newInstance();
	mapper.setBackgroundColor(0, 0, 0, 0);
	actor.setMapper(mapper);

	mapper.setInputConnection(reader.getOutputPort(), 0);
	mapper.setInputData(centerline, 1);
	mapper.setWidth(400);

	const cprManipulator = vtkCPRManipulator.newInstance({
		cprActor: actor,
	});
	const planeManipulator = vtkPlaneManipulator.newInstance();

	return { centerline, actor, mapper, cprManipulator, planeManipulator };
}

async function loadCenterlineData() {
	const aortaJSON = await fetch("./aorta_centerline.json").then((r) => r.json());
	const spineJSON = await fetch("./spine_centerline.json").then((r) => r.json());
	const centerlineJsons = { Aorta: aortaJSON, Spine: spineJSON };
	const centerlineKeys = Object.keys(centerlineJsons);
	return { centerlineJsons, centerlineKeys };
}

function populateCenterlineOptions(centerlineEl, centerlineKeys) {
	for (let i = 0; i < centerlineKeys.length; ++i) {
		const name = centerlineKeys[i];
		const optionEl = document.createElement("option");
		optionEl.innerText = name;
		optionEl.value = name;
		centerlineEl.appendChild(optionEl);
	}
}

// Initialize the app
async function initApp() {
	// Setup all components
	const { renderWindow, renderer, interactor } = setupResliceContainer();
	const {
		renderWindow: mainRenderWindow,
		renderer: stretchRenderer,
		interactor: mainInteractor,
	} = setupMainImageContainer();
	const { centerlineEl, angleEl, animateEl } = getControlElements();
	const { widget, stretchViewType, crossViewType, widgetState, stretchPlane, crossPlane } = createInteractiveCrosshair();
	const { crossRenderer, crossViewWidgetInstance } = setupResliceRenderer(renderWindow, widget, crossViewType);
	const { stretchViewWidgetInstance } = setupMainRenderer(stretchRenderer, widget, stretchViewType);
	const { reslice, resliceMapper, resliceActor } = setupResliceComponents();
	const reader = setupVolumeReader();
	const { centerline, actor, mapper, cprManipulator, planeManipulator } = setupCPRComponents(reader);

	// Load centerline data
	const { centerlineJsons, centerlineKeys } = await loadCenterlineData();
	populateCenterlineOptions(centerlineEl, centerlineKeys);

	function updateDistanceAndDirection() {
		// Directions and position in world space from the widget
		const widgetPlanes = widgetState.getPlanes();
		const worldBitangent = widgetPlanes[stretchViewType].normal;
		const worldNormal = widgetPlanes[stretchViewType].viewUp;
		widgetPlanes[crossViewType].normal = worldNormal;
		widgetPlanes[crossViewType].viewUp = worldBitangent;
		const worldTangent = vec3.cross([], worldBitangent, worldNormal);
		vec3.normalize(worldTangent, worldTangent);
		const worldWidgetCenter = widgetState.getCenter();
		const distance = cprManipulator.getCurrentDistance();

		// CPR mapper tangent and bitangent directions update
		const { orientation } = mapper.getCenterlinePositionAndOrientation(distance);
		// modelDirections * baseDirections = worldDirections
		// => baseDirections = modelDirections^(-1) * worldDirections
		const modelDirections = mat3.fromQuat([], orientation);
		const inverseModelDirections = mat3.invert([], modelDirections);
		const worldDirections = mat3.fromValues(...worldTangent, ...worldBitangent, ...worldNormal);
		const baseDirections = mat3.mul([], inverseModelDirections, worldDirections);
		mapper.setDirectionMatrix(baseDirections);

		// Cross renderer update
		widget.updateReslicePlane(reslice, crossViewType);
		resliceActor.setUserMatrix(reslice.getResliceAxes());
		widget.updateCameraPoints(crossRenderer, crossViewType, false, false, true);
		const crossCamera = crossRenderer.getActiveCamera();
		crossCamera.setViewUp(modelDirections[3], modelDirections[4], modelDirections[5]);

		// Update plane manipulator origin / normal for the cross view
		planeManipulator.setUserOrigin(worldWidgetCenter);
		planeManipulator.setUserNormal(worldNormal);

		// Find the angle (this is the key for syncing!)
		const signedRadAngle = Math.atan2(baseDirections[1], baseDirections[0]);
		const signedDegAngle = (signedRadAngle * 180) / Math.PI;
		const degAngle = signedDegAngle > 0 ? signedDegAngle : 360 + signedDegAngle;
		angleEl.value = degAngle;
		updateState(widgetState, widget.getScaleInPixels(), widget.getRotationHandlePosition());

		const width = mapper.getWidth();
		const height = mapper.getHeight();

		// CPR actor matrix update for main view
		const worldActorTranslation = vec3.scaleAndAdd([], worldWidgetCenter, worldTangent, -0.5 * width);
		vec3.scaleAndAdd(worldActorTranslation, worldActorTranslation, worldNormal, distance - height);
		const worldActorTransform = mat4.fromValues(
			...worldTangent,
			0,
			...worldNormal,
			0,
			...vec3.scale([], worldBitangent, -1),
			0,
			...worldActorTranslation,
			1
		);
		actor.setUserMatrix(worldActorTransform);

		// CPR camera reset for main view
		const stretchCamera = stretchRenderer.getActiveCamera();
		const cameraDistance = (0.5 * height) / Math.tan(radiansFromDegrees(0.5 * stretchCamera.getViewAngle()));
		stretchCamera.setParallelScale(0.5 * height);
		stretchCamera.setParallelProjection(true);
		const cameraFocalPoint = vec3.scaleAndAdd([], worldWidgetCenter, worldNormal, distance - 0.5 * height);
		const cameraPosition = vec3.scaleAndAdd([], cameraFocalPoint, worldBitangent, -cameraDistance);
		stretchCamera.setPosition(...cameraPosition);
		stretchCamera.setFocalPoint(...cameraFocalPoint);
		stretchCamera.setViewUp(...worldNormal);
		stretchRenderer.resetCameraClippingRange();

		interactor.render();
		renderWindow.render();
		mainInteractor.render();
		mainRenderWindow.render();
	}

	function setAngleFromSlider(radAngle) {
		// Compute normal and bitangent directions from angle
		const origin = [0, 0, 0];
		const normalDir = [0, 0, 1];
		const bitangentDir = [0, 1, 0];
		vec3.rotateZ(bitangentDir, bitangentDir, origin, radAngle);

		// Get orientation from distance
		const distance = cprManipulator.getCurrentDistance();
		const { orientation } = mapper.getCenterlinePositionAndOrientation(distance);
		const modelDirections = mat3.fromQuat([], orientation);

		// Set widget normal and viewUp from orientation and directions
		const worldBitangent = vec3.transformMat3([], bitangentDir, modelDirections);
		const worldNormal = vec3.transformMat3([], normalDir, modelDirections);
		const widgetPlanes = widgetState.getPlanes();
		widgetPlanes[stretchViewType].normal = worldBitangent;
		widgetPlanes[stretchViewType].viewUp = worldNormal;
		widgetPlanes[crossViewType].normal = worldNormal;
		widgetPlanes[crossViewType].viewUp = worldBitangent;
		widgetState.setPlanes(widgetPlanes);

		updateDistanceAndDirection();
	}

	let currentImage = null;
	function setCenterlineKey(centerlineKey) {
		const centerlineJson = centerlineJsons[centerlineKey];
		if (!currentImage) {
			return;
		}
		// Set positions of the centerline (model coordinates)
		const centerlinePoints = Float32Array.from(centerlineJson.position);
		const nPoints = centerlinePoints.length / 3;
		centerline.getPoints().setData(centerlinePoints, 3);

		// Set polylines of the centerline
		const centerlineLines = new Uint16Array(1 + nPoints);
		centerlineLines[0] = nPoints;
		for (let i = 0; i < nPoints; ++i) {
			centerlineLines[i + 1] = i;
		}
		centerline.getLines().setData(centerlineLines);

		// Create a rotated basis data array to oriented the CPR
		centerline.getPointData().setTensors(
			vtkDataArray.newInstance({
				name: "Orientation",
				numberOfComponents: 16,
				values: Float32Array.from(centerlineJson.orientation),
			})
		);
		centerline.modified();

		const midPointDistance = mapper.getHeight() / 2;
		const { worldCoords } = cprManipulator.distanceEvent(midPointDistance);
		widgetState.setCenter(worldCoords);
		updateDistanceAndDirection();

		widgetState[`getAxis${crossPlane}in${stretchPlane}`]().setManipulator(cprManipulator);
		widgetState[`getAxis${stretchPlane}in${crossPlane}`]().setManipulator(planeManipulator);
		widget.setManipulator(cprManipulator);

		renderWindow.render();
	}

	function setupAngleControls() {
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
					const currentAngle = radiansFromDegrees(Number.parseFloat(angleEl.value, 10));
					setAngleFromSlider(currentAngle + 0.1);
				}, 60);
			} else {
				clearInterval(animationId);
			}
		});
	}

	async function loadAndSetupVolumeData() {
		await reader.setUrl(volumePath);
		await reader.loadData();

		const image = reader.getOutputData();
		widget.setImage(image);

		const imageDimensions = image.getDimensions();
		const imageSpacing = image.getSpacing();
		const diagonal = vec3.mul([], imageDimensions, imageSpacing);
		mapper.setWidth(2 * vec3.len(diagonal));

		// Setup main CPR view
		actor.setUserMatrix(widget.getResliceAxes(stretchViewType));
		stretchRenderer.addVolume(actor);
		widget.updateCameraPoints(stretchRenderer, stretchViewType, true, false, true);

		// Setup reslice view
		reslice.setInputData(image);
		resliceActor.setMapper(resliceMapper);
		crossRenderer.addActor(resliceActor);
		widget.updateReslicePlane(reslice, crossViewType);
		resliceActor.setUserMatrix(reslice.getResliceAxes());
		widget.updateCameraPoints(crossRenderer, crossViewType, true, false, true);

		currentImage = image;
		setCenterlineKey(centerlineKeys[0]);

		return image;
	}

	function setupInteractionEvents() {
		crossViewWidgetInstance.onInteractionEvent(updateDistanceAndDirection);
		stretchViewWidgetInstance.onInteractionEvent(updateDistanceAndDirection);
	}

	function setupGlobalVariables(image) {
		if (typeof global !== "undefined") {
			global.source = reader;
			global.renderWindow = renderWindow;
			global.widget = widget;
			global.reslice = reslice;
			global.imageData = image;
		}
	}

	// Setup centerline selection
	centerlineEl.addEventListener("input", () => setCenterlineKey(centerlineEl.value));

	// Load volume data and finalize setup
	const image = await loadAndSetupVolumeData();
	setupInteractionEvents();
	setupAngleControls();
	setupGlobalVariables(image);
} // End initApp

// Start the application
initApp().catch(console.error);
