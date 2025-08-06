import { useEffect, useRef } from "react";
// import "@kitware/vtk.js/Rendering/Profiles/";
// Force the loading of HttpDataAccessHelper to support gzip decompression
// import "@kitware/vtk.js/Sources/IO/Core/DataAccessHelper/HttpDataAccessHelper";
// import "@kitware/vtk.js/Rendering/Profiles/Volume";
// import "@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper";
import vtkVolumeMapper from "@kitware/vtk.js/Rendering/Core/VolumeMapper";
import vtkVolume from "@kitware/vtk.js/Rendering/Core/Volume";
import vtkFullScreenRenderWindow from "@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
import vtkHttpDataSetReader from "@kitware/vtk.js/IO/Core/HttpDataSetReader";
import vtkPiecewiseFunction from "@kitware/vtk.js/Common/DataModel/PiecewiseFunction";
import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
import vtkColorMaps from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps";
import vtkImageCropFilter from "@kitware/vtk.js/Filters/General/ImageCropFilter";
import vtkWidgetManager from "@kitware/vtk.js/Widgets/Core/WidgetManager";
import vtkImageCroppingWidget from "@kitware/vtk.js/Widgets/Widgets3D/ImageCroppingWidget";
// import vtkXMLImageDataReader from "@kitware/vtk.js/IO/XML/XMLImageDataReader";

// import vtkHttpDataSetReader from "../../node_modules/@kitware/vtk.js/IO/Core/HttpDataSetReader";
// import vtkVolumeMapper from "../../node_modules/@kitware/vtk.js/Rendering/Core/VolumeMapper";
// import vtkVolume from "../../node_modules/@kitware/vtk.js/Rendering/Core/Volume";
// import vtkFullScreenRenderWindow from "../../node_modules/@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
// import vtkXMLImageDataReader from "../../node_modules/@kitware/vtk.js/IO/XML/XMLImageDataReader";

export default function Croping() {
	const vtkContainerRef = useRef(null);

	useEffect(() => {
		const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
			rootContainer: vtkContainerRef.current,
		});
		const renderer = fullScreenRenderer.getRenderer();
		const renderWindow = fullScreenRenderer.getRenderWindow();

		const piecewiseFun = vtkPiecewiseFunction.newInstance();
		const lookupTable = vtkColorTransferFunction.newInstance();

		lookupTable.applyColorMap(vtkColorMaps.getPresetByName("Cool to Warm"));
		lookupTable.setMappingRange(0, 256);
		lookupTable.updateRange();

		for (let i = 0; i <= 8; i++) {
			piecewiseFun.addPoint(i * 32, i / 8);
		}

		const actor = vtkVolume.newInstance();
		const mapper = vtkVolumeMapper.newInstance();
		actor.setMapper(mapper);
		actor.getProperty().setScalarOpacity(0, piecewiseFun);
		actor.getProperty().setRGBTransferFunction(0, lookupTable);

		// CROPPING LOGIC
		// const widgetManager = vtkWidgetManager.newInstance();
		// widgetManager.setRenderer(renderer);

		// const widget = vtkImageCroppingWidget.newInstance();
		// const viewWidget = widgetManager.addWidget(widget);

		// const cropFilter = vtkImageCropFilter.newInstance();
		// const cropState = widget.getWidgetState().getCroppingPlanes();
		// cropState.onModified(() => cropFilter.setCroppingPlanes(cropState.getPlanes()));

		const widgetManager = vtkWidgetManager.newInstance();
		widgetManager.setRenderer(renderer);

		// this is a widget factory
		const widget = vtkImageCroppingWidget.newInstance();
		// this is an instance of a widget associated with a renderer
		const viewWidget = widgetManager.addWidget(widget);

		// --- set up crop filter

		const cropFilter = vtkImageCropFilter.newInstance();
		// we listen to cropping widget state to inform the crop filter
		const cropState = widget.getWidgetState().getCroppingPlanes();
		cropState.onModified(() => cropFilter.setCroppingPlanes(cropState.getPlanes()));

		//OPTION 1: USING BUILT IN VTKHTTPDATASETREADER
		const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
		mapper.setInputConnection(reader.getOutputPort());
		reader
			.setUrl("https://kitware.github.io/vtk-js/data/volume/LIDC2.vti")
			.then(() => reader.loadData())
			.then(() => {
				renderer.addVolume(actor);

				const range = reader.getOutputData().getPointData().getScalars().getRange();
				lookupTable.setMappingRange(...range);
				lookupTable.updateRange();

				// update crop widget and filter with image info
				const image = reader.getOutputData();
				cropFilter.setCroppingPlanes(...image.getExtent());
				widget.copyImageDataDescription(image);

				renderer.resetCamera();
				renderWindow.render();

				// --- Enable interactive picking of widgets ---
				widgetManager.enablePicking();
				renderWindow.render();
			});
		// OPTION 2: LOADING DATA USING BROWSER FETCH
		// const reader = vtkXMLImageDataReader.newInstance();
		// fetch("https://kitware.github.io/vtk-js/data/volume/LIDC2.vti")
		// 	.then((r) => r.arrayBuffer())
		// 	.then((d) => {
		// 		console.log(d, "DATA");
		// 		reader.parseAsArrayBuffer(d);
		// 		console.log(reader.getOutputData());
		// 	});
	}, []);
	return <div ref={vtkContainerRef}></div>;
}
