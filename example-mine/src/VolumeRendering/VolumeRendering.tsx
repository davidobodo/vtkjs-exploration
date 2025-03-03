import { useEffect, useRef } from "react";
// import "@kitware/vtk.js/Rendering/Profiles/";
// Force the loading of HttpDataAccessHelper to support gzip decompression
// import "@kitware/vtk.js/Sources/IO/Core/DataAccessHelper/HttpDataAccessHelper";
import "@kitware/vtk.js/Rendering/Profiles/Volume";
import "@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper";
import vtkVolumeMapper from "@kitware/vtk.js/Rendering/Core/VolumeMapper";
import vtkVolume from "@kitware/vtk.js/Rendering/Core/Volume";
import vtkFullScreenRenderWindow from "@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
import vtkHttpDataSetReader from "@kitware/vtk.js/IO/Core/HttpDataSetReader";
import vtkPiecewiseFunction from "@kitware/vtk.js/Common/DataModel/PiecewiseFunction";
// import vtkXMLImageDataReader from "@kitware/vtk.js/IO/XML/XMLImageDataReader";

// import vtkHttpDataSetReader from "../../node_modules/@kitware/vtk.js/IO/Core/HttpDataSetReader";
// import vtkVolumeMapper from "../../node_modules/@kitware/vtk.js/Rendering/Core/VolumeMapper";
// import vtkVolume from "../../node_modules/@kitware/vtk.js/Rendering/Core/Volume";
// import vtkFullScreenRenderWindow from "../../node_modules/@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
// import vtkXMLImageDataReader from "../../node_modules/@kitware/vtk.js/IO/XML/XMLImageDataReader";

export default function VolumeRendering() {
	const vtkContainerRef = useRef(null);

	useEffect(() => {
		const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
			rootContainer: vtkContainerRef.current,
		});
		const renderer = fullScreenRenderer.getRenderer();
		const renderWindow = fullScreenRenderer.getRenderWindow();

		const piecewiseFun = vtkPiecewiseFunction.newInstance();

		for (let i = 0; i <= 8; i++) {
			piecewiseFun.addPoint(i * 32, i / 8);
		}

		const actor = vtkVolume.newInstance();
		const mapper = vtkVolumeMapper.newInstance();
		actor.setMapper(mapper);
		actor.getProperty().setScalarOpacity(0, piecewiseFun);

		//OPTION 1: USING BUILT IN VTKHTTPDATASETREADER
		const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
		mapper.setInputConnection(reader.getOutputPort());
		reader
			.setUrl("https://kitware.github.io/vtk-js/data/volume/LIDC2.vti")
			.then(() => reader.loadData())
			.then(() => {
				renderer.addVolume(actor);
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
