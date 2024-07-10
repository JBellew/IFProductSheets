"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";
import "./../style/datatables.less";
import * as $ from 'jquery';
import DOMPurify from 'dompurify';
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;

import 'datatables.net';

import { VisualFormattingSettingsModel } from "./settings";

interface ProductSheetItem {
    Category: string;
    ProductType: string;
    ProductSheet: string;
    Output: string; 
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private tableElement: JQuery<HTMLElement>;
    private lastUpdateOptions: VisualUpdateOptions;
    private selectedCategory: string = "";
    private selectedProductType: string = "";

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.formattingSettings = new VisualFormattingSettingsModel();
        this.target = options.element;

        // Create table element
        this.tableElement = $('<div style="overflow-y: visible; overflow-x: hidden; height: 50vh;"><table id="productTable" class="display" width="100%"></table></div>');

        // HTML for the detailed product sheet output
        const MoreDetailsHTML = `
        <div id="moreProductSheet" style='display:none;' tabindex="-1"  aria-hidden="true">
            <div class="product-body">
            <div class="product-particulars">
               <div class='productitem'><div class='header'>Category: </div> <div id="productCategory" class="productCategory"></div> </div>
               <div class='productitem'><div class='header'>Product Type: </div> <div id="productType" class="productType"></div>  </div>
               <div class='productitem'><div class='header'>Product Sheet: </div> <div id="productSheet" class="productSheet"></div> </div>
            <div>
            <hr/>
                <div id="productOutput" class="productOutput"></div>
            </div>
            <div class="product-footer">
                <button type="button" id="closeProductSheet" class="btn btn-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-x close-icon" viewBox="0 0 16 16">
                        <path d="M4.646 4.646a.5.5 0 011 0L8 6.293l2.354-2.354a.5.5 0 01.708.708L8.707 7l2.354 2.354a.5.5 0 01-.708.708L8 7.707l-2.354 2.354a.5.5 0 01-.708-.708L7.293 7 4.646 4.646a.5.5 0 010-.708z"/>
                    </svg> Close
                </button>
            </div>
        </div>
        `;
        
        // Add slicers
        const slicersHTML = `
            <div class="slicers">
                <select id="categorySlicer" class="slicer">
                    <option value="">Select Category</option>
                </select>
                <select id="productTypeSlicer" class="slicer">
                    <option value="">Select Product Type</option>
                </select>
            </div>
        `;
        $(this.target).append(slicersHTML);
        $(this.target).append(this.tableElement);
        $(this.target).append(MoreDetailsHTML);

        // Bind close button click event to hide the modal
        $(document).on('click', '#closeProductSheet', function() {
            $('#moreProductSheet').hide();
        });

        // Bind change events to slicers
        $(document).on('change', '#categorySlicer', () => {
            this.selectedCategory = $('#categorySlicer').val() as string || "";
            this.selectedProductType = ""; // Reset product type when category changes
            this.updateSlicer();
        });
        $(document).on('change', '#productTypeSlicer', () => {
            this.selectedProductType = $('#productTypeSlicer').val() as string || "";
            this.updateSlicer();
        });
    }

    public update(options: VisualUpdateOptions) {
        this.lastUpdateOptions = options;

        // Populate the formatting settings model
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);

        const dataViews = options.dataViews;
        if (dataViews && dataViews[0]) {
            const dataView = dataViews[0];

            // Map dataView rows to ProductSheetItem objects, with default values for missing data
            const tableData = dataView.table.rows.map(row => ({
                Category: row[0] ? row[0] as string : "No Category",
                ProductType: row[1] ? row[1] as string : "No Product Type",
                ProductSheet: row[2] ? row[2] as string : "No Product Sheet",
                Output: row[3] ? row[3] as string : "No Output"
            }));

            const headerColor = this.formattingSettings.tableSettingsCard.headerColor.value.value;
            const headerFontColor = this.formattingSettings.tableSettingsCard.headerFontColor.value.value;
            const tableHeight = this.formattingSettings.tableSettingsCard.tableHeight.value;
            const pageLength = this.formattingSettings.tableSettingsCard.pageLength.value;

            this.populateSlicers(tableData);
            const filteredData = this.filterData(tableData);
            this.renderTable(filteredData, headerColor, headerFontColor, tableHeight, pageLength);
        }
    }

    private renderTable(data: ProductSheetItem[], headerColor: string, headerFontColor: string, tableHeight: number, pageLength: number) {
        // Adjust table container height
        this.tableElement.css('height', `${tableHeight}vh`);

        // Destroy existing DataTable if it exists
        if ($.fn.DataTable.isDataTable(this.tableElement.find('table'))) {
            this.tableElement.find('table').DataTable().destroy();
        }

        // Clear the table content
        this.tableElement.find('table').empty();

        // Initialize DataTable with the mapped data
        const dataTable = this.tableElement.find('table').DataTable({
            data: data,
            columns: [
                { title: "Product Sheet", data: "ProductSheet" },
                { title: "Output", data: "Output" },
                { title: "Category", data: "Category", visible: false },
                { title: "Product Type", data: "ProductType", visible: false }
            ],
            paging: true,
            searching: true,
            autoWidth: false,
            pageLength: pageLength,
            order: [[0, 'desc']],
            columnDefs: [
                { targets: 0, width: '30%' },
                { targets: 1, width: '70%' }
            ],
            language: {
                emptyTable: "No Products to show"
            },
            dom: 'frtp'
        });

        // Apply header colors
        this.tableElement.find('thead th').css('background-color', headerColor);
        this.tableElement.find('thead th').css('color', headerFontColor);

        // Add click event to open product detail div
        this.tableElement.find('table tbody').on('click', 'tr', function () {
            const rowData = dataTable.row(this).data();
            $('#productCategory').text(rowData.Category);
            $('#productType').text(rowData.ProductType);
            $('#productSheet').text(rowData.ProductSheet);
            $('#productOutput').html(DOMPurify.sanitize(rowData.Output)); // eslint-disable-line powerbi-visuals/no-implied-inner-html
            $('#moreProductSheet').show();
        });
    }

    private populateSlicers(data: ProductSheetItem[]) {
        const categories = [...new Set(data.map(item => item.Category))];
        const productTypes = this.selectedCategory ? [...new Set(data
            .filter(item => item.Category === this.selectedCategory)
            .map(item => item.ProductType))] : [];

        const categorySlicer = $('#categorySlicer');
        const productTypeSlicer = $('#productTypeSlicer');

        categorySlicer.empty().append('<option value="">Select Category</option>');
        categories.forEach(category => {
            categorySlicer.append(`<option value="${category}">${category}</option>`);
        });

        productTypeSlicer.empty().append('<option value="">Select Product Type</option>');
        productTypes.forEach(type => {
            productTypeSlicer.append(`<option value="${type}">${type}</option>`);
        });

        categorySlicer.val(this.selectedCategory);
        productTypeSlicer.val(this.selectedProductType);
    }

    private filterData(data: ProductSheetItem[]): ProductSheetItem[] {
        const selectedCategory = this.selectedCategory;
        const selectedProductType = this.selectedProductType;

        if (!selectedProductType) {
            return [];
        }

        return data.filter(item => {
            return (selectedCategory ? item.Category === selectedCategory : true) &&
                   (selectedProductType ? item.ProductType === selectedProductType : true);
        });
    }

    private updateSlicer() {
        if (this.lastUpdateOptions) {
            this.update(this.lastUpdateOptions);
        }
    }

    public getFormattingModel() {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
