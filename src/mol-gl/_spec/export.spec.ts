/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Vec3, Mat4 } from '../../mol-math/linear-algebra';
import { ValueCell } from '../../mol-util';

import { createValueColor } from '../../mol-geo/geometry/color-data';
import { createValueSize } from '../../mol-geo/geometry/size-data';
import { RenderableState } from '../renderable';
import { createRenderObject } from '../render-object';
import { PointsValues } from '../renderable/points';
import { createEmptyMarkers } from '../../mol-geo/geometry/marker-data';
import { fillSerial } from '../../mol-util/array';
import { Color } from '../../mol-util/color';
import { Sphere3D } from '../../mol-math/geometry';
import { createEmptyOverpaint } from '../../mol-geo/geometry/overpaint-data';
import { createEmptyTransparency } from '../../mol-geo/geometry/transparency-data';
import { ObjExporter } from '../export';

function createPoints() {
    const aPosition = ValueCell.create(new Float32Array([0, -1, 0, -1, 0, 0, 1, 1, 0]))
    const aGroup = ValueCell.create(fillSerial(new Float32Array(3)))
    const aInstance = ValueCell.create(fillSerial(new Float32Array(1)))
    const color = createValueColor(Color(0xFF0000))
    const size = createValueSize(1)
    const marker = createEmptyMarkers()
    const overpaint = createEmptyOverpaint()
    const transparency = createEmptyTransparency()

    const aTransform = ValueCell.create(new Float32Array(16))
    const m4 = Mat4.identity()
    Mat4.toArray(m4, aTransform.ref.value, 0)
    const transform = ValueCell.create(new Float32Array(aTransform.ref.value))
    const extraTransform = ValueCell.create(new Float32Array(aTransform.ref.value))

    const boundingSphere = ValueCell.create(Sphere3D.create(Vec3.zero(), 2))
    const invariantBoundingSphere = ValueCell.create(Sphere3D.create(Vec3.zero(), 2))

    const values: PointsValues = {
        aPosition,
        aGroup,
        aTransform,
        aInstance,
        ...color,
        ...marker,
        ...size,
        ...overpaint,
        ...transparency,

        uAlpha: ValueCell.create(1.0),
        uInstanceCount: ValueCell.create(1),
        uGroupCount: ValueCell.create(3),

        alpha: ValueCell.create(1.0),
        drawCount: ValueCell.create(3),
        instanceCount: ValueCell.create(1),
        matrix: ValueCell.create(m4),
        transform,
        extraTransform,
        boundingSphere,
        invariantBoundingSphere,

        uSizeFactor: ValueCell.create(1),
        dPointSizeAttenuation: ValueCell.create(true),
        dPointFilledCircle: ValueCell.create(false),
        uPointEdgeBleach: ValueCell.create(0.5),
    }
    const state: RenderableState = {
        visible: true,
        alphaFactor: 1,
        pickable: true,
        opaque: true
    }

    return createRenderObject('points', values, state, -1)
}

describe('export', () => {
    it('obj', () => {
        const exporter = new ObjExporter()
        const points = createPoints()
        exporter.add(points)
        const objData = exporter.getData()

        expect(objData.obj).toEqual('');
    })
})