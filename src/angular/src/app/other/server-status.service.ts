import {Injectable, NgZone} from '@angular/core';
import {Observable} from "rxjs/Observable";
import {BehaviorSubject} from "rxjs/Rx";

import {Record} from 'immutable';

import {LoggerService} from "../common/logger.service";
import {SseUtil} from "../common/sse.util";
import {Localization} from "../common/localization";

/**
 * ServerStatus immutable
 */
interface IServerStatus {
    up: boolean;
    errorMessage: string;
}
const DefaultServerStatus: IServerStatus = {
    up: null,
    errorMessage: null
};
const ServerStatusRecord = Record(DefaultServerStatus);
export class ServerStatus extends ServerStatusRecord implements IServerStatus {
    readonly up: boolean;
    readonly errorMessage: string;

    constructor(props) {
        super(props);
    }
}

/**
 * ServerStatus as serialized by the backend.
 * Note: naming convention matches that used in JSON
 */
interface ServerStatusJson {
    up: boolean;
    error_msg: string;
}


@Injectable()
export class ServerStatusService {

    private readonly STATUS_STREAM_URL = "/server/status-stream";
    private readonly STATUS_STREAM_RETRY_INTERVAL_MS = 3000;

    private _status: BehaviorSubject<ServerStatus> =
        new BehaviorSubject(new ServerStatus({
            up: true
        }));

    constructor(private _logger: LoggerService,
                private _zone: NgZone) {
        this.init();
    }

    private init() {
        this.createSseObserver();
    }

    private createSseObserver(){
        // Observable-SSE code from https://stackoverflow.com/a/36827897/8571324
        const observable = Observable.create(observer => {
            const eventSource = new EventSource(this.STATUS_STREAM_URL);
            SseUtil.addSseListener("status", eventSource, observer);

            eventSource.onerror = x => this._zone.run(() => observer.error(x));

            return () => {
                eventSource.close();
            };
        });
        observable.subscribe({
            next: (x) => this.parseStatus(x["data"]),
            error: err => {
                // Log the error
                this._logger.error("SSE Error: %O", err);

                // Notify the clients
                this._status.next(new ServerStatus({up: false, errorMessage: Localization.Error.SERVER_DISCONNECTED}));

                // Retry after a delay
                setTimeout(() => {this.createSseObserver()}, this.STATUS_STREAM_RETRY_INTERVAL_MS);
            }
        });
    }

    /**
     * Parse an event and notify subscribers
     * @param {string} data
     */
    private parseStatus(data: string) {
        let statusJson: ServerStatusJson = JSON.parse(data);
        let status = new ServerStatus({up: statusJson.up, errorMessage: statusJson.error_msg});
        this._status.next(status);
    }

    get status() : Observable<ServerStatus> {
        return this._status.asObservable();
    }
}