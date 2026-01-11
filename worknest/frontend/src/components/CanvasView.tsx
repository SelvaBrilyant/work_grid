import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import rough from "roughjs";
import { nanoid } from "nanoid";
import { getSocket } from "@/lib/socket";
import { useChatStore, useAuthStore } from "@/store";
import { Button } from "@/components/ui/button";
import {
    MousePointer2,
    Pencil,
    Square,
    Circle,
    ArrowUpRight,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

const generator = rough.generator();

interface Element {
    id: string;
    type: "pencil" | "rectangle" | "ellipse" | "arrow" | "text";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    points?: { x: number; y: number }[];
    text?: string;
    color: string;
    strokeWidth: number;
}

export function CanvasView() {
    const { activeChannel } = useChatStore();
    const { user } = useAuthStore();
    const [elements, setElements] = useState<Element[]>([]);
    const [action, setAction] = useState<"none" | "drawing" | "moving" | "texting">("none");
    const [tool, setTool] = useState<Element["type"]>("pencil");
    const [color, setColor] = useState("#000000");
    const [cursors, setCursors] = useState<{ [userId: string]: { x: number; y: number; name: string } }>({});

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const socket = getSocket();

    const drawElement = (roughCanvas: ReturnType<typeof rough.canvas>, context: CanvasRenderingContext2D, element: Element) => {
        const options = { stroke: element.color, strokeWidth: element.strokeWidth };

        switch (element.type) {
            case "pencil":
                if (element.points) {
                    const stroke = element.points.map(p => [p.x, p.y] as [number, number]);
                    context.beginPath();
                    context.strokeStyle = element.color;
                    context.lineWidth = element.strokeWidth;
                    context.lineJoin = "round";
                    context.lineCap = "round";
                    stroke.forEach(([x, y], i) => {
                        if (i === 0) context.moveTo(x, y);
                        else context.lineTo(x, y);
                    });
                    context.stroke();
                }
                break;
            case "rectangle":
                roughCanvas.draw(generator.rectangle(element.x1, element.y1, element.x2 - element.x1, element.y2 - element.y1, options));
                break;
            case "ellipse": {
                const width = element.x2 - element.x1;
                const height = element.y2 - element.y1;
                roughCanvas.draw(generator.ellipse(element.x1 + width / 2, element.y1 + height / 2, width, height, options));
                break;
            }
            case "arrow": {
                // Simplified arrow (just a line for now)
                roughCanvas.draw(generator.line(element.x1, element.y1, element.x2, element.y2, options));
                break;
            }
            case "text":
                context.font = "20px Inter";
                context.fillStyle = element.color;
                context.fillText(element.text || "", element.x1, element.y1);
                break;
        }
    };

    // Load initial state
    useEffect(() => {
        if (!activeChannel) return;

        const loadCanvas = async () => {
            try {
                const response = await axios.get(`/api/canvas/${activeChannel.id}`);
                if (response.data.success) {
                    const loadedElements = response.data.data.elements.map((el: Element & { x: number; y: number; width: number; height: number }) => ({
                        ...el,
                        x1: el.x,
                        y1: el.y,
                        x2: el.x + (el.width || 0),
                        y2: el.y + (el.height || 0),
                    }));
                    setElements(loadedElements);
                }
            } catch (error) {
                console.error("Failed to load canvas:", error);
            }
        };

        loadCanvas();

        socket?.emit("canvas:join", { channelId: activeChannel.id });

        socket?.on("canvas:elements-received", ({ elements: newElements, senderId }: { elements: Element[]; senderId: string }) => {
            if (senderId !== user?.id) {
                setElements(newElements);
            }
        });

        socket?.on("canvas:cursor-update", ({ userId, cursor }) => {
            if (userId !== user?.id) {
                setCursors((prev) => ({ ...prev, [userId]: cursor }));
            }
        });

        return () => {
            socket?.emit("canvas:leave", { channelId: activeChannel.id });
            socket?.off("canvas:elements-received");
            socket?.off("canvas:cursor-update");
        };
    }, [activeChannel, user?.id, socket]);

    // Save state periodically (debounced)
    useEffect(() => {
        if (!activeChannel || elements.length === 0) return;

        const timer = setTimeout(async () => {
            try {
                await axios.put(`/api/canvas/${activeChannel.id}`, {
                    elements: elements.map(el => ({
                        id: el.id,
                        type: el.type,
                        x: el.x1,
                        y: el.y1,
                        width: el.x2 - el.x1,
                        height: el.y2 - el.y1,
                        points: el.points,
                        text: el.text,
                        color: el.color,
                        strokeWidth: el.strokeWidth,
                        createdBy: user?.id
                    }))
                });
            } catch (error) {
                console.error("Failed to save canvas:", error);
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [elements, activeChannel, user?.id]);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);

        const roughCanvas = rough.canvas(canvas);

        elements.forEach((element) => {
            drawElement(roughCanvas, context, element);
        });
    }, [elements]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (action === "texting") return;

        const { clientX, clientY } = e;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const id = nanoid();
        const newElement: Element = {
            id,
            type: tool,
            x1: x,
            y1: y,
            x2: x,
            y2: y,
            color,
            strokeWidth: 2,
            points: tool === "pencil" ? [{ x, y }] : undefined,
        };

        setElements((prev) => [...prev, newElement]);
        setAction("drawing");
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Send cursor position
        socket?.emit("canvas:cursor-move", {
            channelId: activeChannel?.id,
            x,
            y,
            name: user?.name,
        });

        if (action === "drawing") {
            const index = elements.length - 1;

            const updatedElements = [...elements];
            if (tool === "pencil") {
                updatedElements[index].points = [...(updatedElements[index].points || []), { x, y }];
            } else {
                updatedElements[index].x2 = x;
                updatedElements[index].y2 = y;
            }

            setElements(updatedElements);
            socket?.emit("canvas:element-update", {
                channelId: activeChannel?.id,
                elements: updatedElements,
            });
        }
    };

    const handleMouseUp = () => {
        setAction("none");
    };

    const clearCanvas = () => {
        setElements([]);
        socket?.emit("canvas:element-update", {
            channelId: activeChannel?.id,
            elements: [],
        });
    };

    return (
        <div className="flex-1 flex flex-col items-center bg-muted/10 relative overflow-hidden h-full">
            {/* Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-card border shadow-xl rounded-xl z-10">
                <ToolbarButton active={tool === "pencil"} onClick={() => setTool("pencil")} icon={<Pencil className="h-4 w-4" />} label="Pencil" />
                <ToolbarButton active={tool === "rectangle"} onClick={() => setTool("rectangle")} icon={<Square className="h-4 w-4" />} label="Rectangle" />
                <ToolbarButton active={tool === "ellipse"} onClick={() => setTool("ellipse")} icon={<Circle className="h-4 w-4" />} label="Ellipse" />
                <ToolbarButton active={tool === "arrow"} onClick={() => setTool("arrow")} icon={<ArrowUpRight className="h-4 w-4" />} label="Arrow" />
                <div className="w-px h-6 bg-border mx-1" />
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded-md cursor-pointer border-none bg-transparent"
                />
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" onClick={clearCanvas} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <canvas
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="cursor-crosshair w-full h-full bg-white dark:bg-slate-900"
            />

            {/* Other user cursors */}
            {Object.entries(cursors).map(([userId, data]) => (
                <div
                    key={userId}
                    className="absolute pointer-events-none z-20 transition-all duration-75"
                    style={{ left: data.x, top: data.y }}
                >
                    <MousePointer2 className="h-4 w-4 text-primary fill-primary" />
                    <div className="ml-4 mt-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-md">
                        {data.name}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ToolbarButton({
    active,
    onClick,
    icon,
    label
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <Button
            variant={active ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-lg")}
            onClick={onClick}
            title={label}
        >
            {icon}
        </Button>
    );
}
