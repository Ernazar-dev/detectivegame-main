import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, Redirect } from "wouter";
import { Spin } from "antd";
import { useAuth } from "./lib/auth";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import TeacherLayout from "./layouts/TeacherLayout";
import StudentLayout from "./layouts/StudentLayout";

const TeacherDashboard     = lazy(() => import("./pages/teacher/Dashboard"));
const TeacherTasks         = lazy(() => import("./pages/teacher/Tasks"));
const TeacherTaskEditor    = lazy(() => import("./pages/teacher/TaskEditor"));
const TeacherStudents      = lazy(() => import("./pages/teacher/Students"));
const TeacherSubmissions   = lazy(() => import("./pages/teacher/Submissions"));
const TeacherSubmissionReview = lazy(() => import("./pages/teacher/SubmissionReview"));
const TeacherCharacters    = lazy(() => import("./pages/teacher/Characters"));
const TeacherLocations     = lazy(() => import("./pages/teacher/Locations"));

const StudentDashboard     = lazy(() => import("./pages/student/Dashboard"));
const StudentTasks         = lazy(() => import("./pages/student/Tasks"));
const StudentPlay          = lazy(() => import("./pages/student/Play"));        // 2900+ lines — eng muhimi
const StudentRankings      = lazy(() => import("./pages/student/Rankings"));
const StudentSubmissions   = lazy(() => import("./pages/student/Submissions"));
const StudentProfile       = lazy(() => import("./pages/student/Profile"));
const StudentSubmissionDetail = lazy(() => import("./pages/student/SubmissionDetail"));

function PageLoader() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spin size="large" />
    </div>
  );
}

export default function App() {
  const { user, loading, init } = useAuth();
  useEffect(() => { init(); }, [init]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login"><LoginPage /></Route>
        <Route path="/register"><RegisterPage /></Route>

        {!user && <Route><Redirect to="/login" /></Route>}

        {user?.role === "teacher" && (
          <Route>
            <TeacherLayout>
              <Switch>
                <Route path="/" component={TeacherDashboard} />
                <Route path="/tasks" component={TeacherTasks} />
                <Route path="/tasks/new"><TeacherTaskEditor /></Route>
                <Route path="/tasks/:id"><TeacherTaskEditor /></Route>
                <Route path="/students" component={TeacherStudents} />
                <Route path="/submissions" component={TeacherSubmissions} />
                <Route path="/submissions/:id"><TeacherSubmissionReview /></Route>
                <Route path="/rankings" component={StudentRankings} />
                <Route path="/library/characters" component={TeacherCharacters} />
                <Route path="/library/locations" component={TeacherLocations} />
                <Route><Redirect to="/" /></Route>
              </Switch>
            </TeacherLayout>
          </Route>
        )}

        {user?.role === "student" && (
          <Route>
            <Switch>
              <Route path="/play/:id"><StudentPlay /></Route>
              <Route>
                <StudentLayout>
                  <Switch>
                    <Route path="/" component={StudentDashboard} />
                    <Route path="/tasks" component={StudentTasks} />
                    <Route path="/rankings" component={StudentRankings} />
                    <Route path="/submissions" component={StudentSubmissions} />
                    <Route path="/submissions/:id"><StudentSubmissionDetail /></Route>
                    <Route path="/profile" component={StudentProfile} />
                    <Route><Redirect to="/" /></Route>
                  </Switch>
                </StudentLayout>
              </Route>
            </Switch>
          </Route>
        )}
      </Switch>
    </Suspense>
  );
}