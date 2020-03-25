/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { GraphicsRenderObject } from './render-object';
import { MeshValues } from './renderable/mesh';
import { LinesValues } from './renderable/lines';
import { PointsValues } from './renderable/points';

// TODO move to mol-io/writer?
// TODO add PlyExporter
// TODO support colors via mtl in ObjExporter
// TODO support `spheres` RenderObject.type by writing a converter to `mesh`

type RenderObjectExportData = {
    [k: string]: string | Uint8Array | undefined
}

interface RenderObjectExporter<D extends RenderObjectExportData> {
    add(renderObject: GraphicsRenderObject): void
    getData(): D
}

// http://paulbourke.net/dataformats/obj/

export type ObjData = {
    obj: string
    mtl?: string
}

export class ObjExporter implements RenderObjectExporter<ObjData> {
    private vertices: string[] = [] // v
    private normals: string[] = [] // vn
    private faces: string[] = [] // f
    private lines: string[] = [] // l
    private points: string[] = [] // p

    private addMesh(values: MeshValues) {

    }

    private addLines(values: LinesValues) {

    }

    private addPoints(values: PointsValues) {

    }

    add(renderObject: GraphicsRenderObject) {
        switch (renderObject.type) {
            case 'mesh': this.addMesh(renderObject.values as MeshValues)
            case 'lines': this.addLines(renderObject.values as LinesValues)
            case 'points': this.addPoints(renderObject.values as PointsValues)
        }
    }

    getData() {
        const out: string[] = []
        if (this.vertices.length) out.push(this.vertices.join('\n'))
        if (this.normals.length) out.push(this.normals.join('\n'))
        if (this.faces.length) out.push(this.faces.join('\n'))
        if (this.lines.length) out.push(this.lines.join('\n'))
        if (this.points.length) out.push(this.points.join('\n'))

        return {
            obj: out.join('\n')
        }
    }

    constructor() {

    }
}