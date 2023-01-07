import * as plotly from "plotly.js-dist-min"
import React, { FC, useEffect } from "react"
import { Typography, useTheme, Box, Grid } from "@mui/material"
import { plotlyDarkTemplate } from "./PlotlyDarkMode"
import {
  Target,
  useFilteredTrials,
  useObjectiveAndUserAttrTargets,
  useParamTargets,
} from "../trialFilter"

const plotDomId = "graph-parallel-coordinate"

const useTargets = (study: StudyDetail | null): Target[] => {
  const [targets1, _target1, _setter1] = useObjectiveAndUserAttrTargets(study)
  const [targets2, _target2, _setter2] = useParamTargets(
    study?.intersection_search_space || []
  )
  return [...targets1, ...targets2]
}

export const GraphParallelCoordinate: FC<{
  study: StudyDetail | null
}> = ({ study = null }) => {
  const theme = useTheme()
  const targets = useTargets(study)

  const trials = useFilteredTrials(study, targets, false, false)
  useEffect(() => {
    if (study !== null) {
      plotCoordinate(study, trials, targets, theme.palette.mode)
    }
  }, [study, trials, targets, theme.palette.mode])

  return (
    <Grid container direction="row">
      <Grid
        item
        xs={3}
        container
        direction="column"
        sx={{
          paddingRight: theme.spacing(2),
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Typography variant="h6" sx={{ margin: "1em 0", fontWeight: 600 }}>
          Parallel Coordinate
        </Typography>
      </Grid>
      <Grid item xs={9}>
        <Box id={plotDomId} sx={{ height: "450px" }} />
      </Grid>
    </Grid>
  )
}

const plotCoordinate = (
  study: StudyDetail,
  trials: Trial[],
  targets: Target[],
  mode: string
) => {
  if (document.getElementById(plotDomId) === null) {
    return
  }

  const layout: Partial<plotly.Layout> = {
    margin: {
      l: 70,
      t: 50,
      r: 50,
      b: 100,
    },
    template: mode === "dark" ? plotlyDarkTemplate : {},
  }
  if (trials.length === 0) {
    plotly.react(plotDomId, [], layout)
    return
  }

  const maxLabelLength = 40
  const breakLength = maxLabelLength / 2
  const ellipsis = "…"
  const truncateLabelIfTooLong = (originalLabel: string): string => {
    return originalLabel.length > maxLabelLength
      ? originalLabel.substring(0, maxLabelLength - ellipsis.length) + ellipsis
      : originalLabel
  }
  const breakLabelIfTooLong = (originalLabel: string): string => {
    const truncated = truncateLabelIfTooLong(originalLabel)
    return truncated
      .split("")
      .map((c, i) => {
        return (i + 1) % breakLength == 0 ? c + "<br>" : c
      })
      .join("")
  }

  const dimensions = targets
    .map((target) => {
      if (target.kind === "objective" || target.kind === "user_attr") {
        const values: number[] = trials.map(
          (t) => target.getTargetValue(t) as number
        )
        return {
          label: target.toLabel(study.objective_names),
          values: values,
          range: [Math.min(...values), Math.max(...values)],
        }
      } else {
        const s = study.intersection_search_space.find(
          (s) => s.name === target.key
        ) as SearchSpaceItem  // Must be already filtered.

        const values: number[] = trials.map(
          (t) => target.getTargetValue(t) as number
        )
        if (s.distribution.type !== "CategoricalDistribution") {
          return {
            label: breakLabelIfTooLong(s.name),
            values: values,
            range: [s.distribution.low, s.distribution.high],
          }
        } else {
          // categorical
          const vocabArr: string[] = s.distribution.choices.map((c) => c.value)
          const tickvals: number[] = vocabArr.map((v, i) => i)
          return {
            label: breakLabelIfTooLong(s.name),
            values: values,
            range: [0, s.distribution.choices.length - 1],
            // @ts-ignore
            tickvals: tickvals,
            ticktext: vocabArr,
          }
        }
      }
    })
  if (dimensions.length === 0) {
    console.log("Must not reach here.")
    plotly.react(plotDomId, [], layout)
    return
  }
  let reversescale = false
  if (
    targets[0].kind === "objective" &&
    (targets[0].getObjectiveId() as number) < study.directions.length &&
    study.directions[targets[0].getObjectiveId() as number] === "maximize"
  ) {
    reversescale = true
  }
  const plotData: Partial<plotly.PlotData>[] = [
    {
      type: "parcoords",
      dimensions: dimensions,
      labelangle: 30,
      labelside: "bottom",
      line: {
        color: dimensions[0]["values"],
        // @ts-ignore
        colorscale: "Blues",
        colorbar: {
          title: targets[0].toLabel(study.objective_names),
        },
        showscale: true,
        reversescale: reversescale,
      },
    },
  ]

  plotly.react(plotDomId, plotData, layout)
}
