"use client";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceY,
} from "d3-force";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UiThemeMode } from "../../types";
import type { GraphNode, NetworkData } from "./temporal-graph-utils";
import {
  GRAPH_FONT_FAMILY,
  getEdgeAlpha,
  getGraphEdgeStroke,
  getGraphLabelFill,
  getNodeAlpha,
  hexToRgba,
  hitTestNode,
  truncateLabel,
} from "./temporal-graph-utils";

interface TemporalGraphProps {
  data: NetworkData;
  currentDay: number;
  height: number;
  themeMode?: UiThemeMode;
  scrubbing?: boolean;
  resetToken?: number;
  onNodeClick?: (nodeId: number) => void;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

type SimLink = {
  source: SimNode;
  target: SimNode;
  weight: number;
};

function randomCenteredOffset(range: number) {
  return (Math.random() - 0.5) * range;
}

function getGraphCenterY(height: number) {
  return height / 2 + 8;
}

function getLabelHalfWidth(node: Pick<GraphNode, "label">) {
  return Math.max(34, truncateLabel(node.label, 18).length * 3.4);
}

function constrainNodeToViewport(node: SimNode, width: number, height: number) {
  const labelHalfWidth = Math.min(width * 0.22, getLabelHalfWidth(node));
  const horizontalPad = Math.max(node.radius + 14, labelHalfWidth + 8);
  const minX = horizontalPad;
  const maxX = Math.max(minX, width - horizontalPad);
  const minY = node.radius + 24;
  const maxY = Math.max(minY, height - node.radius - 48);

  if (maxX <= minX) {
    node.x = width / 2;
    node.vx *= -0.2;
  } else if (node.x < minX) {
    node.x = minX;
    node.vx *= -0.3;
  } else if (node.x > maxX) {
    node.x = maxX;
    node.vx *= -0.3;
  }

  if (maxY <= minY) {
    node.y = getGraphCenterY(height);
    node.vy *= -0.2;
  } else if (node.y < minY) {
    node.y = minY;
    node.vy *= -0.3;
  } else if (node.y > maxY) {
    node.y = maxY;
    node.vy *= -0.3;
  }
}

export function TemporalGraph({
  data,
  currentDay,
  height,
  themeMode = "light",
  scrubbing = false,
  resetToken = 0,
  onNodeClick,
}: TemporalGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const nodesByIdRef = useRef<Map<number, SimNode>>(new Map());
  const activeNodesRef = useRef<SimNode[]>([]);
  const activeLinksRef = useRef<SimLink[]>([]);
  const currentDayRef = useRef(currentDay);
  const previousDayRef = useRef(currentDay);
  const resetTokenRef = useRef(resetToken);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const heightRef = useRef(height);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    for (const link of activeLinksRef.current) {
      const edge = {
        source: link.source.id,
        target: link.target.id,
        weight: link.weight,
      };
      const alpha = getEdgeAlpha(edge, link.source, link.target, currentDayRef.current);
      if (alpha <= 0.01) continue;

      context.beginPath();
      context.moveTo(link.source.x, link.source.y);
      context.lineTo(link.target.x, link.target.y);
      context.strokeStyle = getGraphEdgeStroke(themeMode, alpha);
      context.lineWidth = link.weight * 1.8;
      context.stroke();
    }

    for (const node of activeNodesRef.current) {
      const alpha = getNodeAlpha(node, currentDayRef.current);
      if (alpha <= 0.01) continue;

      const age = currentDayRef.current - node.timelineDay;
      if (age >= 0 && age < 0.8) {
        const birthProgress = Math.max(0, Math.min(1, age / 0.8));
        const ringOneOpacity = (1 - birthProgress) * 0.15;
        const ringTwoOpacity = (1 - birthProgress) * 0.1;

        context.beginPath();
        context.arc(node.x, node.y, node.radius + birthProgress * 18, 0, Math.PI * 2);
        context.fillStyle = hexToRgba(node.color, ringOneOpacity);
        context.fill();

        context.beginPath();
        context.arc(node.x, node.y, node.radius + birthProgress * 10, 0, Math.PI * 2);
        context.fillStyle = hexToRgba(node.color, ringTwoOpacity);
        context.fill();
      }

      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.fillStyle = hexToRgba(node.color, alpha * 0.9);
      context.fill();
      context.strokeStyle = hexToRgba(node.color, Math.min(1, alpha * 1.4));
      context.lineWidth = 1;
      context.stroke();

      if (alpha > 0.3) {
        const labelAlpha = Math.min(1, (alpha - 0.3) / 0.25);
        context.font = `11px ${GRAPH_FONT_FAMILY}`;
        context.textAlign = "center";
        context.fillStyle = getGraphLabelFill(themeMode, labelAlpha);
        context.fillText(truncateLabel(node.label, 18), node.x, node.y + node.radius + 13);
      }
    }
  }, [height, themeMode, width]);

  const updateSimulationForces = useCallback(
    (links: SimLink[]) => {
      if (!simulationRef.current) return;

      simulationRef.current
        .force("charge", forceManyBody<SimNode>().strength(-900))
        .force(
          "link",
          forceLink<SimNode, SimLink>(links)
            .id((node) => node.id)
            .distance((link) => 90 + (1 - link.weight) * 60)
            .strength((link) => link.weight * 0.4)
        )
        .force(
          "center",
          forceCenter<SimNode>(widthRef.current / 2, getGraphCenterY(heightRef.current)).strength(
            0.03
          )
        )
        .force(
          "vertical",
          forceY<SimNode>(getGraphCenterY(heightRef.current)).strength(0.045)
        )
        .force("collision", forceCollide<SimNode>().radius((node) => node.radius + 14))
        .alphaDecay(0.02)
        .velocityDecay(0.35);
    },
    []
  );

  const rebuildActiveGraph = useCallback(
    (
      targetDay: number,
      alpha: number,
      hardReset: boolean,
      bornNodeIds: number[] = [],
      freezeLayout = false
    ) => {
      const allNodes = nodesByIdRef.current;
      const centerX = widthRef.current / 2;
      const centerY = getGraphCenterY(heightRef.current);

      if (hardReset) {
        allNodes.forEach((node) => {
          node.x = centerX + randomCenteredOffset(24);
          node.y = centerY + randomCenteredOffset(24);
          node.vx = 0;
          node.vy = 0;
        });
      }

      for (const nodeId of bornNodeIds) {
        const node = allNodes.get(nodeId);
        if (!node) continue;
        node.x = centerX + randomCenteredOffset(20);
        node.y = centerY + randomCenteredOffset(20);
        node.vx = randomCenteredOffset(4);
        node.vy = randomCenteredOffset(4);
      }

      const activeNodes = data.nodes
        .filter((node) => node.timelineDay <= targetDay)
        .map((node) => allNodes.get(node.id))
        .filter((node): node is SimNode => Boolean(node));

      const activeNodeIds = new Set(activeNodes.map((node) => node.id));
      const activeLinks = data.edges
        .filter(
          (edge) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target)
        )
        .map((edge) => {
          const source = allNodes.get(edge.source);
          const target = allNodes.get(edge.target);
          if (!source || !target) return null;
          return {
            source,
            target,
            weight: edge.weight,
          };
        })
        .filter((edge): edge is SimLink => Boolean(edge));

      activeNodesRef.current = activeNodes;
      activeLinksRef.current = activeLinks;

      if (!simulationRef.current) {
        simulationRef.current = forceSimulation<SimNode>(activeNodes);
        simulationRef.current.on("tick", () => {
          for (const node of activeNodesRef.current) {
            constrainNodeToViewport(node, widthRef.current, heightRef.current);
          }
          draw();
        });
      }

      simulationRef.current.nodes(activeNodes);
      updateSimulationForces(activeLinks);
      if (freezeLayout) {
        simulationRef.current.alpha(0);
        simulationRef.current.stop();
      } else {
        simulationRef.current.alpha(alpha).restart();
      }
      draw();
    },
    [data.edges, data.nodes, draw, updateSimulationForces]
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? wrapper.clientWidth;
      setWidth(nextWidth);
    });

    observer.observe(wrapper);
    setWidth(wrapper.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    widthRef.current = width;
    heightRef.current = height;
  }, [height, width]);

  useEffect(() => {
    if (width <= 0) return;

    const centerX = widthRef.current / 2;
    const centerY = getGraphCenterY(heightRef.current);
    const nextNodes = new Map<number, SimNode>();

    data.nodes.forEach((node) => {
      const existing = nodesByIdRef.current.get(node.id);
      nextNodes.set(node.id, {
        ...node,
        x: existing?.x ?? centerX + randomCenteredOffset(30),
        y: existing?.y ?? centerY + randomCenteredOffset(30),
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
      });
    });

    nodesByIdRef.current = nextNodes;
    rebuildActiveGraph(currentDayRef.current, 0.8, true);
  }, [data.nodes, rebuildActiveGraph, width]);

  useEffect(() => {
    currentDayRef.current = currentDay;
    if (width <= 0) return;

    const previousDay = previousDayRef.current;
    const didResetTokenChange = resetTokenRef.current !== resetToken;

    if (didResetTokenChange) {
      resetTokenRef.current = resetToken;
      rebuildActiveGraph(currentDay, scrubbing ? 0 : 0.8, true, [], scrubbing);
      previousDayRef.current = currentDay;
      return;
    }

    if (scrubbing) {
      rebuildActiveGraph(currentDay, 0, false, [], true);
      previousDayRef.current = currentDay;
      return;
    }

    if (currentDay < previousDay) {
      rebuildActiveGraph(currentDay, 0.8, true);
      previousDayRef.current = currentDay;
      return;
    }

    const bornNodeIds = data.nodes
      .filter((node) => node.timelineDay > previousDay && node.timelineDay <= currentDay)
      .map((node) => node.id);

    if (bornNodeIds.length > 0) {
      rebuildActiveGraph(currentDay, 0.4, false, bornNodeIds);
    } else if (Math.floor(previousDay) !== Math.floor(currentDay)) {
      rebuildActiveGraph(currentDay, 0.2, false);
    } else {
      draw();
    }

    previousDayRef.current = currentDay;
  }, [currentDay, data.nodes, draw, rebuildActiveGraph, resetToken, scrubbing, width]);

  useEffect(() => {
    updateSimulationForces(activeLinksRef.current);
    if (!scrubbing) {
      simulationRef.current?.alpha(0.25).restart();
    } else {
      simulationRef.current?.stop();
    }
    draw();
  }, [draw, scrubbing, themeMode, updateSimulationForces]);

  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
    };
  }, []);

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onNodeClick) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hitNode = hitTestNode(activeNodesRef.current, x, y, currentDayRef.current);
      if (hitNode) {
        onNodeClick(hitNode.id);
      }
    },
    [onNodeClick]
  );

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onClick={handleCanvasClick}
      />
    </div>
  );
}
