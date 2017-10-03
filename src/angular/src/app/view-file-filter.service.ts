import {Injectable} from '@angular/core';
import {Observable} from "rxjs/Observable";
import {BehaviorSubject} from "rxjs/Rx";

import * as Immutable from 'immutable';

import {LoggerService} from "./logger.service";
import {ViewFile} from "./view-file"
import {ViewFileFilterCriteria, ViewFileService} from "./view-file.service";
import {ViewFileFilter} from "./view-file-filter";


class StatusFilterCriteria implements ViewFileFilterCriteria {
    status: ViewFile.Status = null;

    meetsCriteria(viewFile: ViewFile): boolean {
        return this.status == null || this.status == viewFile.status;
    }
}


/**
 * ViewFileFilterService class provides filtering services for
 * view files
 *
 * This class provides actions to control the filtering parameters.
 * It also provides the filter state for display purposes.
 */
@Injectable()
export class ViewFileFilterService {

    private _filter: BehaviorSubject<ViewFileFilter> = new BehaviorSubject(new ViewFileFilter({}));

    private _viewFiles: Immutable.List<ViewFile> = Immutable.List<ViewFile>([]);
    private _statusFilter: StatusFilterCriteria = new StatusFilterCriteria();

    constructor(private _logger: LoggerService,
                private _viewFileService: ViewFileService) {
        _viewFileService.files.subscribe(files => {
            this._viewFiles = files;
            this.updateState();
        });

        // Setup the filters
        this._viewFileService.setFilterCriteria(this._statusFilter);
    }

    get filter(): Observable<ViewFileFilter> {
        return this._filter.asObservable();
    }

    /**
     * Filter by status
     * @param {ViewFile.Status} status, or null for disabled/all
     */
    public filterStatus(status: ViewFile.Status) {
        if(this._statusFilter.status == status) return;

        if(this.isStatusEnabled(status)) {
            this._logger.debug("Setting status filter: %O", status == null ? "all" : status);
            this._statusFilter.status = status;
            // Note: updateState() will be called when filters are reapplied
            //       but we call it anyways to speed up the UI update of filter state
            this.updateState();
            this._viewFileService.reapplyFilters();
        } else {
            // Normally we would want to log a warning here, however the component
            // currently has no way to disable the click action on a button because
            // async pipes cannot be used inside the click action. Therefore, the
            // component has no way to disable the button on its end
            // So instead, we gracefully accept this invalid action and do nothing
        }
    }

    private isStatusEnabled(status: ViewFile.Status) {
        if(status == null) return true;
        return this._viewFiles.findIndex(f => f.status == status) >= 0;
    }

    private updateState() {
        let downloadedEn = this.isStatusEnabled(ViewFile.Status.DOWNLOADED);
        let downloadingEn = this.isStatusEnabled(ViewFile.Status.DOWNLOADING);
        let queuedEn = this.isStatusEnabled(ViewFile.Status.QUEUED);
        let stoppedEn = this.isStatusEnabled(ViewFile.Status.STOPPED);
        let defaultEn = this.isStatusEnabled(ViewFile.Status.DEFAULT);

        let allSel = this._statusFilter.status == null;
        let downloadedSel = this._statusFilter.status == ViewFile.Status.DOWNLOADED;
        let downloadingSel = this._statusFilter.status == ViewFile.Status.DOWNLOADING;
        let queuedSel = this._statusFilter.status == ViewFile.Status.QUEUED;
        let stoppedSel = this._statusFilter.status == ViewFile.Status.STOPPED;
        let defaultSel = this._statusFilter.status == ViewFile.Status.DEFAULT;

        let filter: ViewFileFilter = new ViewFileFilter({
            downloadedFilterEnabled: downloadedEn,
            downloadingFilterEnabled: downloadingEn,
            queuedFilterEnabled: queuedEn,
            stoppedFilterEnabled: stoppedEn,
            defaultFilterEnabled: defaultEn,

            allFilterSelected: allSel,
            downloadedFilterSelected: downloadedSel,
            downloadingFilterSelected: downloadingSel,
            queuedFilterSelected: queuedSel,
            stoppedFilterSelected: stoppedSel,
            defaultFilterSelected: defaultSel,
        });
        this._logger.debug("Updated filter: %O", filter.toJS());
        this._filter.next(filter);
    }
}
