import { Component, OnInit } from '@angular/core';
import { SitesService } from '../services/sites.service';
import { HttpEventType } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup } from '@angular/forms';
import { tileLayer, latLng, Map, Layer } from 'leaflet';
import { FormService } from '../services/form.service';
import { Conf } from './../config';
import * as L from 'leaflet';
import * as _ from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-add-site',
  templateUrl: './add-site.component.html',
  styleUrls: ['./add-site.component.scss'],

})
export class AddSiteComponent implements OnInit {
  selectedFiles: File[];
  modalRef: NgbModalRef;
  selectedSubthemes = [];
  photos = [];
  noticeName: any;
  noticeLaoded = false;
  siteForm: FormGroup;
  siteJson;
  themes: any;
  subthemes: any;
  loadForm = false;
  map;
  id_site = null;
  markers = [];

  drawnItems = new L.FeatureGroup();
  markerCoordinates = [];
  icon = L.icon({
    iconSize: [25, 41],
    iconAnchor: [13, 41],
    iconUrl: './assets/marker-icon.png',
    shadowUrl: './assets/marker-shadow.png'
  });
  options = {
    layers: [
      tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    ],
    zoom: 10,
    center: latLng(45.372167, 6.819077)
  };
  sitesLoaded = false;
  addSite = false;
  drawOptions = {
    position: 'topleft',
    draw: {
      polygon: false,
      circle: false,
      rectangle: false,
      polyline: false,
      circlemarker: false,
      marker: {
        icon: this.icon
      }
    },
    edit: {
      featureGroup: this.drawnItems
    }
  };
  drawControl = new L.Control.Draw();
  previewImage: string | ArrayBuffer;
  cor: any;
  alert: { type: string; message: string; };
  site: any;
  edit_btn = false;
  edit_btn_text = 'Éditer';
  submit_btn_text = 'Ajouter';
  initPhotos: any[];
  deleted_photos = [];
  photoRequired = false;
  new_photos = [];
  marker: Layer[] = [];
  center: any;
  toast_msg: string;
  communes: undefined;
  currentUser: any;
  zoom: number;
  constructor(
    private sitesService: SitesService,
    public formService: FormService,
    protected router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private modalService: NgbModal,
    private authService: AuthService,
  ) {
  }

  ngOnInit() {
    this.currentUser = this.authService.currentUser;
    this.id_site = this.route.snapshot.params['id'];
    this.siteForm = this.formService.initFormSite();
    this.siteForm.controls['id_stheme'].disable();
    forkJoin([this.sitesService.getThemes(), this.sitesService.getSubthemes(), this.sitesService.getCommunes()]).subscribe(results => {
      this.themes = results[0];
      this.subthemes = results[1];
      this.communes = results[2];
      this.selectedSubthemes = this.subthemes;
      if (this.id_site) {
        this.getSite(this.id_site);
        this.submit_btn_text = 'Enregistrer';
      } else {
        this.edit_btn = true;
        this.loadForm = true;
        this.themes_onChange();
        this.latlan_onChange();
      }
    });
  }

  onMapReady(map: Map) {
    const info = new L.Control();
    info.setPosition('topleft');
    info.onAdd = () => {
      const container = L.DomUtil.create('button', ' btn btn-sm btn-outline-shadow leaflet-bar leaflet-control ');
      container.innerHTML = '<i style="line-height: unset" class="icon-full_screen"> </i>';
      container.style.backgroundColor = 'white';
      container.title = 'Recenter la catre';
      container.onclick = () => {
        this.center = latLng(this.site.geom);
        this.zoom = 10;
      };
      return container;
    };
    info.addTo(map);

    map.addLayer(this.drawnItems);
    L.EditToolbar.Delete.include({
      removeAllLayers: false
    });
    this.map = map;
    map.on(L.Draw.Event.CREATED, (event) => {
      const layer = (event as any).layer;
      this.markerCoordinates.push(layer._latlng);
      this.siteForm.controls['lat'].setValue(this.markerCoordinates[0].lat.toFixed(6));
      this.siteForm.controls['lng'].setValue(this.markerCoordinates[0].lng.toFixed(6));
      this.drawControl.setDrawingOptions({
        marker: false
      });
      map.removeControl(this.drawControl);
      map.addControl(this.drawControl);
    });


    map.on(L.Draw.Event.EDITED, (event) => {
      let layer = (event as any).layers._layers;
      layer = layer[Object.keys(layer)[0]];
      this.markerCoordinates.push(layer._latlng);
      this.siteForm.controls['lat'].setValue(this.markerCoordinates[0].lat.toFixed(6));
      this.siteForm.controls['lng'].setValue(this.markerCoordinates[0].lng.toFixed(6));
    });
    map.on(L.Draw.Event.DELETED, (event) => {
      const markers = [];
      map.eachLayer(function (layer) {
        if (layer._latlng) {
          markers.push(layer._latlng);
        }
      });
      if (markers.length === 0) {
        this.siteForm.controls['lat'].reset();
        this.siteForm.controls['lng'].reset();
        this.markerCoordinates = [];
        map.removeControl(this.drawControl);
        this.drawControl.setDrawingOptions({
          marker: {
            icon: this.icon
          }
        });
        map.addControl(this.drawControl);
      }
    });
  }

  onDrawReady(drawControl) {

    this.drawControl = drawControl;
    if (this.id_site) {
      this.map.removeControl(this.drawControl);
    }
  }

  onFileSelected(event) {
    console.log('event', event);
    this.selectedFiles = event.target.files;
  }
  noticeSelect(event) {
    if (event.target.files && event.target.files.length > 0) {
      this.noticeName = event.target.files[0].name;
      this.noticeLaoded = true;
    }
  }

  removeNotice() {
    this.noticeName = null;
    this.noticeLaoded = false;
    this.siteForm.controls['notice'].reset();
  }

  onCancel() {
    this.siteForm.reset();
    this.router.navigate(['sites']);
  }

  submitSite(siteForm) {
    this.alert = null;
    if (siteForm.valid && this.photos.length > 0) {
      this.siteJson = _.omit(siteForm.value, ['id_theme', 'notice', 'lat', 'lng', 'id_stheme']);
      this.siteJson.geom = 'SRID=4326;POINT(' + siteForm.value.lng + ' ' + siteForm.value.lat + ')';
      if (!this.id_site) {
        this.sitesService.addSite(this.siteJson).subscribe(
          (site) => {
            // tslint:disable-next-line:quotemark
            this.toast_msg = "Point d'observation ajouté avec succès";
            this.addPhotos(Number(site.id_site), siteForm.value.id_theme, siteForm.value.id_stheme);
          },
          (err) => {
            if (err.status === 403) {
              this.router.navigate(['']);
              this.toastr.error('votre session est expirée', '', { positionClass: 'toast-bottom-right' });
            }
          }
        );
      } else {
        this.patchSite(this.siteJson, siteForm.value.id_theme, siteForm.value.id_stheme);
      }
    } else if (this.photos.length === 0) {
      this.photoRequired = true;
    }
  }

  getPhoto(photo) {
    this.alert = null;
    this.photoRequired = false;
    const reader = new FileReader();
    reader.readAsDataURL(photo.photo_file[0]);
    reader.onload = () => {
      this.previewImage = reader.result;
      photo.imgUrl = this.previewImage;
    };
    photo.name = photo.path_file_photo;
    photo.filePhoto = photo.photo_file[0];
    this.photos.push(photo);
  }

  /*
    uploadImage() {
      console.log('this.selectedFile,', this.selectedFiles);
      const image: FormData = new FormData();
      _.forEach(this.selectedFiles, (filesItem) => {
        image.append('image', filesItem, filesItem.name);
      });
      this.sitesService.addPhotos(image).subscribe(
        (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            console.log('resUplod', event.loaded);
          }
        }
      );
    }
  */

  addPhotos(id_site, id_theme, id_stheme, ) {
    const photosData: FormData = new FormData();
    let photoJson;
    let photos;
    if (this.id_site) {
      photos = this.new_photos;
    } else {
      photos = this.photos;
    }
    _.forEach(photos, (photo) => {
      photoJson = _.omit(photo, ['photo_file', 'imgUrl', 'filePhoto', 'name']);
      photoJson.id_site = Number(id_site);
      photosData.append('image', photo.filePhoto);
      photosData.append('data', JSON.stringify(photoJson));
    });
    this.sitesService.addPhotos(photosData).subscribe(
      (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          // console.log('resUplod', event.loaded);
        }
      },
      err => {
        console.log('err upload photo', err);
        if (err.error.error === 'image_already_exist') {
          this.setAlert(err.error.image);
        }
        if (err.status === 403) {
          this.router.navigate(['']);
          this.toastr.error('votre session est expirée', '', { positionClass: 'toast-bottom-right' });
        }
      },
      () => this.addThemes(id_site, id_theme, id_stheme)
    );
  }

  addThemes(id_site, themes, sthemes) {
    // tslint:disable-next-line:prefer-const
    let tab_stheme = [];
    _.forEach(sthemes, (sub) => {
      tab_stheme.push(_.find(this.subthemes, { 'id_stheme': sub }));
    });
    // tslint:disable-next-line:prefer-const
    let stheme_theme = [];
    _.forEach(tab_stheme, (stheme) => {
      _.forEach(stheme.themes, (item) => {
        if (_.includes(themes, item)) {
          stheme_theme.push({ 'id_site': id_site, 'id_theme': item, 'id_stheme': stheme.id_stheme });
        }
      });
    });
    this.sitesService.addThemes({ 'data': stheme_theme }).subscribe(
      (response) => {
        this.siteForm.disable();
        this.edit_btn = false;
        this.toastr.success(this.toast_msg, '', { positionClass: 'toast-bottom-right' });
        this.router.navigate(['/sites/details/', id_site]);
      },
      (err) => {
        if (err.status === 403) {
          this.router.navigate(['']);
          this.toastr.error('votre session est expirée', '', { positionClass: 'toast-bottom-right' });
        }
      }
    );
  }

  setAlert(message) {
    this.alert = {
      type: 'danger',
      message: 'La ' + message + ' existe déjà',
    };
  }

  getSite(id_site) {
    this.sitesService.getsiteById(id_site).subscribe(
      (site) => {
        this.site = site.site[0];
        _.forEach(site.photos, (photo) => {
          this.photos.push({ 'id_photo': photo.id_photo, 'imgUrl': Conf.staticPicturesUrl + photo.sm, 'name': photo.path_file_photo });
          this.initPhotos = this.photos;
        });
      },
      (err) => console.log('err', err),
      () => {
        this.initMarker(this.site.geom[0], this.site.geom[1]);
        this.patchForm();
        this.loadForm = true;
        this.siteForm.disable();
        this.themes_onChange();
        this.latlan_onChange();
      }
    );
  }

  themes_onChange() {
    this.siteForm.controls['id_theme'].statusChanges
      .subscribe(() => {
        this.selectedSubthemes = [];
        // this.siteForm.controls['id_stheme'].reset();
        console.log('this.subthemes', this.subthemes);
        if (this.siteForm.controls['id_theme'].value && this.siteForm.controls['id_theme'].value.length !== 0) {
          this.siteForm.controls['id_stheme'].enable();
          _.forEach(this.subthemes, (subtheme) => {
            _.forEach(this.siteForm.controls['id_theme'].value, (idTheme) => {
              if (_.includes(subtheme.themes, Number(idTheme)) && !_.find(this.selectedSubthemes, { 'id_stheme': subtheme.id_stheme })) {
                this.selectedSubthemes.push(subtheme);
                console.log('this.selectedSubthemes', this.selectedSubthemes);
              }
            });
          });
          /*   _.forEach(this.siteForm.controls['id_theme'].value, (idTheme) => {
               if (_.includes(selectedSubthemes, Number(idTheme)) && !_.find(this.selectedSubthemes, { 'id_stheme': subtheme.id_stheme })) {
                 this.selectedSubthemes.push(subtheme);
                 console.log('this.selectedSubthemes', this.selectedSubthemes);
               }
             }); */
        } else {
          this.siteForm.controls['id_stheme'].disable();
          this.selectedSubthemes = [];
        }
      });
  }

  latlan_onChange() {
    this.siteForm.controls['lat'].statusChanges
      .subscribe(() => {
        if (this.siteForm.controls['lat'].valid && this.siteForm.controls['lng'].valid && this.markerCoordinates.length === 0) {
          this.drawnItems.clearLayers();
          this.initMarker(this.siteForm.controls['lat'].value, this.siteForm.controls['lng'].value);
        } else if (this.siteForm.controls['lat'].invalid && this.siteForm.controls['lng'].invalid) {
          this.drawnItems.clearLayers();
          this.map.removeControl(this.drawControl);
          this.drawControl.setDrawingOptions({
            marker: {
              icon: this.icon
            }
          });
          this.map.addControl(this.drawControl);
        }
      });
    this.siteForm.controls['lng'].statusChanges
      .subscribe(() => {
        if (this.siteForm.controls['lat'].valid && this.siteForm.controls['lng'].valid && this.markerCoordinates.length === 0) {
          this.drawnItems.clearLayers();
          this.initMarker(this.siteForm.controls['lat'].value, this.siteForm.controls['lng'].value);
        } else if (this.siteForm.controls['lat'].invalid && this.siteForm.controls['lng'].invalid) {
          this.drawnItems.clearLayers();
          this.map.removeControl(this.drawControl);
          this.drawControl.setDrawingOptions({
            marker: {
              icon: this.icon
            }
          });
          this.map.addControl(this.drawControl);
        }
      });
  }


  patchSite(siteJson, themes, sthemes) {
    siteJson.id_site = this.id_site;
    _.forEach(this.photos, (photo) => {
      if (_.has(photo, 'filePhoto')) {
        this.new_photos.push(photo);
      }
    });
    this.sitesService.updateSite(siteJson).subscribe(
      (res) => {
        // tslint:disable-next-line:quotemark
        this.toast_msg = "Point d'observation mis à jour";
        this.edit_btn_text = 'Éditer';
        if (this.deleted_photos.length > 0) {
          this.sitesService.deletePhotos(this.deleted_photos).subscribe(
            () => '',
            (err) => {
              if (err.status === 403) {
                this.router.navigate(['']);
                this.toastr.error('votre session est expirée', '', { positionClass: 'toast-bottom-right' });
              }
            }
          );
        }
        this.addPhotos(this.id_site, themes, sthemes);
      }
    );
  }

  editForm() {
    this.edit_btn = !this.edit_btn;
    if (!this.edit_btn) {
      this.map.removeControl(this.drawControl);
      this.edit_btn_text = 'Éditer';
      this.patchForm();
      this.siteForm.disable();
      this.initMarker(this.site.geom[0], this.site.geom[1]);
    } else {
      this.map.addControl(this.drawControl);
      this.edit_btn_text = 'Annuler';
      this.siteForm.enable();
    }
    this.siteForm.controls['id_stheme'].setValue(this.site.subthemes);
  }

  initMarker(lat, lan) {
    L.marker(latLng(lat, lan), { icon: this.icon }).addTo(this.drawnItems);
    this.center = latLng(lat, lan);
    this.map.removeControl(this.drawControl);
    this.drawControl.setDrawingOptions({
      marker: false
    });
    this.map.addControl(this.drawControl);
    if (this.id_site && !this.edit_btn) {
      this.map.removeControl(this.drawControl);
    }
  }

  openDeleteModal(content) {
    this.modalRef = this.modalService.open(content, { windowClass: 'delete-modal', centered: true });
  }

  cancelDelete() {
    this.modalRef.close();
  }

  deletePhoto(photo) {
    _.remove(this.photos, (item) => {
      return item === photo;
    });
    photo.imgUrl = photo.imgUrl.replace(Conf.staticPicturesUrl, '');
    this.deleted_photos.push(photo);
  }

  deleteSite() {
    this.sitesService.deleteSite(this.id_site).subscribe(
      (res) => {
        this.router.navigate(['sites']);
      },
      (err) => {
        if (err.status === 403) {
          this.router.navigate(['']);
          this.toastr.error('votre session est expirée', '', { positionClass: 'toast-bottom-right' });
        }
      }
    );
    this.modalRef.close();
  }

  patchForm() {
    this.siteForm.patchValue({
      'name_site': this.site.name_site,
      'desc_site': this.site.desc_site,
      'testim_site': this.site.testim_site,
      'publish_site': this.site.publish_site,
      'lng': this.site.geom[1].toFixed(6),
      'lat': this.site.geom[0].toFixed(6),
      'id_theme': this.site.themes,
      'id_stheme': this.site.subthemes,
      'code_city_site': this.site.code_city_site,
      'legend_site': this.site.legend_site,
      'notice': null,
    });
  }

}

