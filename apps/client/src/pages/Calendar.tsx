import React, { useRef, useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { EventClickArg } from "@fullcalendar/core";
import "../styles/calendar-styles.css";
import CalenderTaskModal from "../components/CalenderTaskModal";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import api from "../utils/api";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  color: string;
  workspaceName?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  type: string;
  status: string;
  projectId: string;
  dueDate?: string;
  assigneeId?: string;
}

interface CalendarProps {
  workspaceName?: string;
  darkMode: boolean;
}

const convertTailwindColorToHex = (color: string) => {
  const colorMap: Record<string, string> = {
    "bg-emerald-500": "#10B981",
    "bg-blue-500": "#3b82f6",
    "bg-purple-500": "#a855f7",
    "bg-green-500": "#22c55e",
    "bg-indigo-600": "#4F46E5",
    "bg-red-500": "#ef4444",
    "bg-yellow-500": "#eab308",
  };
  return colorMap[color] || "#10B981";
};

const convertEventsToFullCalendarFormat = (events: CalendarEvent[]) => {
  return events.map((event) => {
    const eventDate = new Date(event.date);
    let start = null;
    let end = null;

    if (event.startTime) {
      const [hours, minutes] = event.startTime.split(":").map(Number);
      start = new Date(eventDate);
      start.setHours(hours, minutes);

      if (event.endTime) {
        const [endHours, endMinutes] = event.endTime.split(":").map(Number);
        end = new Date(eventDate);
        end.setHours(endHours, endMinutes);
      }
    } else {
      start = eventDate;
    }

    return {
      id: event.id,
      title: event.title,
      start: start,
      end: end || undefined,
      backgroundColor: convertTailwindColorToHex(event.color),
      borderColor: convertTailwindColorToHex(event.color),
      textColor: "#FFFFFF",
      classNames: "rounded-md shadow-sm",
    };
  });
};

const Calendar: React.FC<CalendarProps> = ({ workspaceName, darkMode }) => {
  const calendarRef = useRef<FullCalendar | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [taskState, setTaskState] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchTasksByWorkspaceName = async () => {
    try {
      const token = await getToken();
      if (!token || !workspaceName) {
        throw new Error("Authentication token or workspace name not available");
      }
      const response = await axios.get(
        api.getApiEndpoint(`api/tasks/workspace/${workspaceName}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setTasks(response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error fetching tasks:",
          error.response?.data?.error || error.message,
        );
      } else if (error instanceof Error) {
        console.error("Error fetching tasks:", error.message);
      } else {
        console.error("Unknown error fetching tasks");
      }
    }
  };

  useEffect(() => {
    if (workspaceName) {
      fetchTasksByWorkspaceName();
    }
  }, [workspaceName, getToken]);

  const mapTasksToEvents = (tasks: Task[]): CalendarEvent[] => {
    const priorityColors: Record<string, string> = {
      HIGH: "bg-red-500",
      MEDIUM: "bg-yellow-500",
      LOW: "bg-green-500",
    };
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      date: task.dueDate ? new Date(task.dueDate) : new Date(),
      color: priorityColors[task.priority] || "bg-blue-500",
      workspaceName: workspaceName,
    }));
  };

  const fullCalendarEvents = convertEventsToFullCalendarFormat(
    mapTasksToEvents(tasks),
  );

  const handleDateClick = (arg: DateClickArg) => {
    setSelectedDate(arg.dateStr);
    setTaskState(true);
    // console.log("Date clicked", arg);
  };

  const handleEventClick = () => {
    // console.log("Event clicked", arg);
  };

  const handleTaskAdded = () => {
    fetchTasksByWorkspaceName();
    // console.log("Task added successfully");
  };

  const viewOptions = [
    { name: "Month", view: "dayGridMonth" },
    { name: "Week", view: "timeGridWeek" },
    { name: "Day", view: "timeGridDay" },
  ];

  const changeView = (viewName: string) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(viewName);
    }
  };

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const viewportHeight = window.innerHeight;
        const containerTop = containerRef.current.getBoundingClientRect().top;
        const availableHeight = viewportHeight - containerTop - 40;
        setContainerHeight(Math.max(500, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-lg flex flex-col p-6 ${
        darkMode ? "bg-[#1C1C1C] text-white" : "bg-white text-black"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
        <CalenderTaskModal
          workspaceName={workspaceName}
          isOpen={taskState}
          onClose={() => setTaskState(false)}
          darkMode={darkMode}
          projectId=""
          onTaskAdded={handleTaskAdded}
          selectedDate={selectedDate}
          getToken={getToken}
        />

        <div
          className={`flex space-x-2 rounded-md p-1 ${
            darkMode ? "bg-[#171717]" : "bg-gray-200"
          }`}
        >
          {viewOptions.map((option) => (
            <button
              key={option.view}
              onClick={() => changeView(option.view)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors hover:${
                darkMode ? "bg-[#333]" : "bg-gray-300"
              } focus:outline-none`}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`fullcalendar-${darkMode ? "dark" : "light"} flex-grow overflow-hidden`}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          events={fullCalendarEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          height={containerHeight || "auto"}
          themeSystem="standard"
          dayCellClassNames={
            darkMode
              ? "bg-[#171717] hover:bg-[#333] border-[#2C2C2C]"
              : "bg-white hover:bg-gray-100 border-gray-200"
          }
          eventClassNames="rounded-md"
          slotLabelClassNames={darkMode ? "text-gray-400" : "text-gray-600"}
          dayHeaderClassNames={
            darkMode ? "text-gray-400 font-medium" : "text-gray-700 font-medium"
          }
          titleFormat={{ year: "numeric", month: "long" }}
          buttonText={{
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
          }}
          viewClassNames={darkMode ? "bg-[#1C1C1C]" : "bg-white"}
          allDayClassNames={
            darkMode ? "bg-[#1C1C1C] text-white" : "bg-white text-black"
          }
          nowIndicatorClassNames="bg-emerald-500"
        />
      </div>
    </div>
  );
};

export default Calendar;
