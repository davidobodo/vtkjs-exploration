import React, { useState } from "react";
import "@kitware/vtk.js/Rendering/Profiles/Geometry";
import vtkFullScreenRenderWindow from "@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkConeSource from "@kitware/vtk.js/Filters/Sources/ConeSource";
import vtkOutlineFilter from "@kitware/vtk.js/Filters/General/OutlineFilter";

function App() {
	const context = React.useRef();
	const vtkContainerRef = React.useRef(null);

	React.useEffect(() => {
		if (!context.current) {
			const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
				rootContainer: vtkContainerRef.current,
			});
			const renderer = fullScreenRenderer.getRenderer();
			const renderWindow = fullScreenRenderer.getRenderWindow();

			// CONE
			const coneSource = vtkConeSource.newInstance({ height: 1.0 });
			const mapper = vtkMapper.newInstance();
			const actor = vtkActor.newInstance();
			mapper.setInputConnection(coneSource.getOutputPort());
			actor.setMapper(mapper);
			renderer.addActor(actor);
			renderer.resetCamera();
			renderWindow.render();

			// FILTER
			const filter = vtkOutlineFilter.newInstance();
			filter.setInputConnection(coneSource.getOutputPort());
			const outlineActor = vtkActor.newInstance();
			const outlineMapper = vtkMapper.newInstance();
			outlineActor.setMapper(outlineMapper);
			outlineMapper.setInputConnection(filter.getOutputPort());
			renderer.addActor(outlineActor);
			renderWindow.render();
		}
	}, [vtkContainerRef]);

	return (
		<div>
			<div ref={vtkContainerRef}></div>
		</div>
	);
}

export default App;
