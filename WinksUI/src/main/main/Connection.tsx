import { ChildProcess, spawn } from "child_process";

class Connection {
    private static address = 'localhost';
    private static port = 12345;
    public static pythonScriptPath: String;
    public static pythonProcess: ChildProcess;
    public static pythonPID: number | undefined;

    // Given a path, create a new object which also instantiates
    // the python script for head tracking / wink detection
    constructor(path: string) {
        path = process.cwd() + path;
        Connection.pythonScriptPath = path;
        Connection.pythonProcess = spawn('python', [`${Connection.pythonScriptPath}`]);
        Connection.pythonPID = Connection.pythonProcess.pid;
    }

    // Kill the process with the PID held by the object
    // With signal "SIGINT"
    public static kill() {
        if (typeof(Connection.pythonPID) == "number") {
            process.kill(Connection.pythonPID, 'SIGINT');
        }
    }

    // Send message to python process' stdin (python's input())
    public send(message: string) {
        Connection.pythonProcess.stdin?.write(message + "\n");
    }

    public getAddress() {
        return Connection.address;
    }

    public setAddress(addr: string) {
        Connection.address = addr;
    }

    public getPort() {
        return Connection.port;
    }

    public setPort(port: number) {
        Connection.port = port;
    }
}

export default Connection