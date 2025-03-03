import { useEffect, useRef } from "react";
// import "@kitware/vtk.js/Rendering/Profiles/";
// Force the loading of HttpDataAccessHelper to support gzip decompression
// import "@kitware/vtk.js/Sources/IO/Core/DataAccessHelper/HttpDataAccessHelper";
import "@kitware/vtk.js/Rendering/Profiles/Volume";
import "@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper";
import vtkFullScreenRenderWindow from "@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
import vtkHttpDataSetReader from "@kitware/vtk.js/IO/Core/HttpDataSetReader";
import ImageConstants from "vtk.js/Sources/Rendering/Core/ImageMapper/Constants";
import vtkInteractorStyleImage from "@kitware/vtk.js/Interaction/Style/InteractorStyleImage";
import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice";
import vtkImageMapper from "@kitware/vtk.js/Rendering/Core/ImageMapper";
// import vtkXMLImageDataReader from "@kitware/vtk.js/IO/XML/XMLImageDataReader";

// import vtkHttpDataSetReader from "../../node_modules/@kitware/vtk.js/IO/Core/HttpDataSetReader";
// import vtkVolumeMapper from "../../node_modules/@kitware/vtk.js/Rendering/Core/VolumeMapper";
// import vtkVolume from "../../node_modules/@kitware/vtk.js/Rendering/Core/Volume";
// import vtkFullScreenRenderWindow from "../../node_modules/@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
// import vtkXMLImageDataReader from "../../node_modules/@kitware/vtk.js/IO/XML/XMLImageDataReader";

const { SlicingMode } = ImageConstants;

export default function VolumeSlicing() {
	const vtkContainerRef = useRef(null);

	useEffect(() => {
		const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
			rootContainer: vtkContainerRef.current,
		});
		const renderer = fullScreenRenderer.getRenderer();
		const renderWindow = fullScreenRenderer.getRenderWindow();

		// renderer camera to parallel projection
		renderer.getActiveCamera().setParallelProjection(true);

		// --- Set up interactor style for image slicing
		const istyle = vtkInteractorStyleImage.newInstance();
		istyle.setInteractionMode("IMAGE_SLICING");
		renderWindow.getInteractor().setInteractorStyle(istyle);

		const actor = vtkImageSlice.newInstance();
		const mapper = vtkImageMapper.newInstance();

		mapper.setSliceAtFocalPoint(true);
		mapper.setSlicingMode(SlicingMode.Z);

		actor.setMapper(mapper);

		actor.getProperty().setColorWindow(255);
		actor.getProperty().setColorLevel(127);

		//OPTION 1: USING BUILT IN VTKHTTPDATASETREADER
		const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
		mapper.setInputConnection(reader.getOutputPort());
		reader
			.setUrl("https://kitware.github.io/vtk-js/data/volume/LIDC2.vti")
			.then(() => reader.loadData())
			.then(() => {
				renderer.addActor(actor);

				renderer.resetCamera();
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
