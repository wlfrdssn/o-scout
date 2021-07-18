import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import ExtentInteraction from "ol/interaction/Extent";
import { useEffect, useMemo, useRef } from "react";
import { getExtent } from "../models/print-area";
import {
  fromProjectedCoord,
  toProjectedCoord,
  transformExtent,
} from "../services/coordinates";
import useEvent, { useMap } from "../store";

export default function PrintArea() {
  const { map, mapFile } = useMap(getMap);
  const { course, setPrintAreaExtent } = useEvent(getSelectedCourse);

  const crs = useMemo(() => mapFile?.getCrs(), [mapFile]);
  const currentExtent = useRef();

  useEffect(() => {
    if (map && course) {
      const interaction = new ExtentInteraction({
        extent: transformExtent(getExtent(course.printArea, course), (c) =>
          toProjectedCoord(crs, c)
        ),
        boxStyle,
      });
      interaction.on(
        "extentchanged",
        ({ extent }) => (currentExtent.current = extent)
      );
      map.on("pointerup", commitExtent);
      map.addInteraction(interaction);

      return () => {
        map.removeInteraction(interaction);
        map.un("pointerup", commitExtent);
      };

      function commitExtent() {
        setPrintAreaExtent(
          course.id,
          transformExtent(currentExtent.current, (c) =>
            fromProjectedCoord(crs, c)
          )
        );
      }
    }
  }, [crs, mapFile, map, course, setPrintAreaExtent]);

  return null;
}

const boxStyle = new Style({
  stroke: new Stroke({ color: "steelblue", width: 5 }),
  fill: null,
});

function getMap({ map, mapFile }) {
  return { map, mapFile };
}

function getSelectedCourse({
  courses,
  selectedCourseId,
  actions: {
    course: { setPrintAreaExtent },
  },
}) {
  return {
    course: courses.find(({ id }) => id === selectedCourseId),
    setPrintAreaExtent,
  };
}